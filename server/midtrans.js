import { createHash, timingSafeEqual } from "node:crypto";
import { upsertPaymentLedgerEntry } from "./paymentLedger.js";

function normalizeEnvironment(value) {
  return String(value || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
}

function toMidtransError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireServerKey(config) {
  if (!config.serverKey) {
    throw toMidtransError("MIDTRANS_SERVER_KEY belum diatur.", 500);
  }
}

function getNotificationSignatureFields(notification = {}) {
  const orderId = String(notification.order_id || "").trim();
  const statusCode = String(notification.status_code || "").trim();
  const grossAmount =
    typeof notification.gross_amount === "string"
      ? notification.gross_amount.trim()
      : Number.isFinite(Number(notification.gross_amount))
        ? Number(notification.gross_amount).toFixed(2)
        : "";

  return { orderId, statusCode, grossAmount };
}

function safeCompareText(left, right) {
  const normalizedLeft = Buffer.from(String(left || "").trim().toLowerCase());
  const normalizedRight = Buffer.from(String(right || "").trim().toLowerCase());

  if (normalizedLeft.length !== normalizedRight.length) return false;
  return timingSafeEqual(normalizedLeft, normalizedRight);
}

function normalizeLedgerNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeLedgerText(value) {
  if (value === null || value === undefined) return null;
  const next = String(value).trim();
  return next || null;
}

function buildPendingLedgerEntry(payload, transaction) {
  return {
    order_id: transaction.orderId,
    user_id: normalizeLedgerText(payload.userId),
    item_type: normalizeLedgerText(payload.itemType),
    item_id: normalizeLedgerText(payload.itemId),
    item_label: normalizeLedgerText(payload.itemName),
    amount_cents: Math.round(Number(payload.amount || 0) * 100),
    payment_method: normalizeLedgerText(payload.paymentMethod || payload.preferredMethod),
    status: "PENDING",
    buyer_email: normalizeLedgerText(payload.buyerEmail),
    buyer_whatsapp: normalizeLedgerText(payload.buyerWhatsApp),
    membership_plan: normalizeLedgerText(payload.membershipPlan),
    ebook_id: normalizeLedgerText(payload.ebookId),
    author_id: normalizeLedgerText(payload.authorId),
    platform_commission_pct: normalizeLedgerNumber(payload.platformCommissionPct),
    platform_commission_cents: normalizeLedgerNumber(payload.platformCommissionCents),
    author_royalty_pct: normalizeLedgerNumber(payload.authorRoyaltyPct),
    author_royalty_cents: normalizeLedgerNumber(payload.authorRoyaltyCents),
    redirect_url: normalizeLedgerText(transaction.redirectUrl),
    transaction_status: "pending",
    transaction_state: "PENDING",
    should_grant_access: false,
    finish_url: normalizeLedgerText(payload.finishUrl),
    metadata: {
      preferredBank: payload.preferredBank || null,
      preferredWallet: payload.preferredWallet || null,
    },
    created_at: new Date().toISOString(),
  };
}

function buildWebhookLedgerEntry(params) {
  const { notification, status, outcome } = params;

  return {
    order_id: status.orderId,
    transaction_status: status.transactionStatus,
    transaction_state: outcome.transactionState,
    should_grant_access: outcome.shouldGrantAccess,
    fraud_status: status.fraudStatus,
    payment_type: normalizeLedgerText(status.paymentType),
    midtrans_status_code: normalizeLedgerText(status.statusCode),
    status:
      outcome.transactionState === "SUCCESS"
        ? "SUCCESS"
        : outcome.transactionState === "PENDING"
          ? "PENDING"
          : "FAILED",
    webhook_received_at: new Date().toISOString(),
    webhook_payload: notification,
    midtrans_response: status.raw,
  };
}

function buildStatusCheckLedgerEntry(params) {
  const { status, outcome } = params;

  return {
    order_id: status.orderId,
    transaction_status: status.transactionStatus,
    transaction_state: outcome.transactionState,
    should_grant_access: outcome.shouldGrantAccess,
    fraud_status: status.fraudStatus,
    payment_type: normalizeLedgerText(status.paymentType),
    midtrans_status_code: normalizeLedgerText(status.statusCode),
    status:
      outcome.transactionState === "SUCCESS"
        ? "SUCCESS"
        : outcome.transactionState === "PENDING"
          ? "PENDING"
          : "FAILED",
    midtrans_response: status.raw,
  };
}

export function getMidtransTransactionOutcome(transactionStatus, fraudStatus = "") {
  const normalizedStatus = String(transactionStatus || "").toLowerCase();
  const normalizedFraud = String(fraudStatus || "").toLowerCase();

  if (normalizedStatus === "settlement") {
    return {
      transactionState: "SUCCESS",
      shouldGrantAccess: true,
      reason: "Pembayaran settlement.",
    };
  }

  if (normalizedStatus === "capture") {
    if (normalizedFraud === "challenge") {
      return {
        transactionState: "PENDING",
        shouldGrantAccess: false,
        reason: "Pembayaran capture tetapi masih challenge fraud review.",
      };
    }

    return {
      transactionState: "SUCCESS",
      shouldGrantAccess: true,
      reason: "Pembayaran capture tervalidasi.",
    };
  }

  if (
    normalizedStatus === "pending" ||
    normalizedStatus === "authorize"
  ) {
    return {
      transactionState: "PENDING",
      shouldGrantAccess: false,
      reason: "Pembayaran masih menunggu penyelesaian.",
    };
  }

  return {
    transactionState: "FAILED",
    shouldGrantAccess: false,
    reason: normalizedStatus
      ? `Status transaksi Midtrans: ${normalizedStatus}.`
      : "Status transaksi Midtrans tidak diketahui.",
  };
}

export function getMidtransConfig(env = process.env) {
  const environment = normalizeEnvironment(env.VITE_MIDTRANS_ENV || env.MIDTRANS_ENV);
  const clientKey = env.VITE_MIDTRANS_CLIENT_KEY || env.MIDTRANS_CLIENT_KEY || "";
  const serverKey = env.MIDTRANS_SERVER_KEY || "";

  return {
    environment,
    clientKey,
    serverKey,
    snapScriptUrl:
      environment === "production"
        ? "https://app.midtrans.com/snap/snap.js"
        : "https://app.sandbox.midtrans.com/snap/snap.js",
    transactionApiUrl:
      environment === "production"
        ? "https://app.midtrans.com/snap/v1/transactions"
        : "https://app.sandbox.midtrans.com/snap/v1/transactions",
    statusApiBaseUrl:
      environment === "production"
        ? "https://api.midtrans.com/v2"
        : "https://api.sandbox.midtrans.com/v2",
  };
}

function toOrderId(seed) {
  const base = String(seed || `NRL-${Date.now()}`)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 48);
  return `${base}-${Date.now()}`;
}

export async function createMidtransTransaction(payload = {}, env = process.env) {
  const config = getMidtransConfig(env);

  requireServerKey(config);

  if (!config.clientKey) {
    throw toMidtransError("VITE_MIDTRANS_CLIENT_KEY belum diatur.", 500);
  }

  const buyerName = String(payload.buyerName || "").trim();
  const buyerEmail = String(payload.buyerEmail || "").trim();
  const buyerWhatsApp = String(payload.buyerWhatsApp || "").trim();
  const amount = Number(payload.amount);
  const itemName = String(payload.itemName || "Pembayaran Naraloka").trim();
  const orderId = toOrderId(payload.orderCode || "NRL");

  if (!buyerName || !buyerEmail || !buyerWhatsApp || !amount || amount <= 0) {
    throw toMidtransError("Data pembayaran tidak lengkap.", 400);
  }

  const requestPayload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(amount),
    },
    customer_details: {
      first_name: buyerName,
      email: buyerEmail,
      phone: buyerWhatsApp,
    },
    item_details: [
      {
        id: String(payload.itemId || "naraloka-checkout"),
        price: Math.round(amount),
        quantity: 1,
        name: itemName,
      },
    ],
    callbacks: payload.finishUrl
      ? {
          finish: payload.finishUrl,
        }
      : undefined,
  };

  const response = await fetch(config.transactionApiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw toMidtransError(text || "Gagal membuat transaksi Midtrans.", response.status);
  }

  const data = await response.json();
  const transaction = {
    token: data.token,
    redirectUrl: data.redirect_url,
    orderId,
    environment: config.environment,
    clientKey: config.clientKey,
    snapScriptUrl: config.snapScriptUrl,
  };
  const ledger = await upsertPaymentLedgerEntry(buildPendingLedgerEntry(payload, transaction), env);

  return {
    ...transaction,
    ledger,
  };
}

export async function getMidtransTransactionStatus(orderId, env = process.env) {
  const config = getMidtransConfig(env);
  requireServerKey(config);

  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    throw toMidtransError("orderId wajib diisi.", 400);
  }

  const response = await fetch(
    `${config.statusApiBaseUrl}/${encodeURIComponent(normalizedOrderId)}/status`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw toMidtransError(text || "Gagal memeriksa status transaksi Midtrans.", response.status);
  }

  const data = await response.json();
  const result = {
    orderId: data.order_id || normalizedOrderId,
    transactionStatus: String(data.transaction_status || "").toLowerCase(),
    fraudStatus: String(data.fraud_status || "").toLowerCase(),
    paymentType: data.payment_type || "",
    statusCode: String(data.status_code || ""),
    raw: data,
  };

  const outcome = getMidtransTransactionOutcome(result.transactionStatus, result.fraudStatus);
  const ledger = await upsertPaymentLedgerEntry(buildStatusCheckLedgerEntry({ status: result, outcome }), env);

  return {
    ...result,
    transactionState: outcome.transactionState,
    shouldGrantAccess: outcome.shouldGrantAccess,
    ledger,
  };
}

export function computeMidtransNotificationSignature(notification = {}, env = process.env) {
  const config = getMidtransConfig(env);
  requireServerKey(config);

  const { orderId, statusCode, grossAmount } = getNotificationSignatureFields(notification);
  if (!orderId || !statusCode || !grossAmount) {
    throw toMidtransError(
      "Payload webhook Midtrans tidak lengkap. order_id, status_code, dan gross_amount wajib ada.",
      400
    );
  }

  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${config.serverKey}`)
    .digest("hex");
}

export function verifyMidtransNotificationSignature(notification = {}, env = process.env) {
  const receivedSignature = String(notification.signature_key || "").trim();
  if (!receivedSignature) {
    throw toMidtransError("signature_key Midtrans tidak ditemukan.", 400);
  }

  const expectedSignature = computeMidtransNotificationSignature(notification, env);
  return safeCompareText(expectedSignature, receivedSignature);
}

export async function handleMidtransNotification(notification = {}, env = process.env) {
  const { orderId } = getNotificationSignatureFields(notification);
  if (!orderId) {
    throw toMidtransError("order_id Midtrans tidak ditemukan.", 400);
  }

  const signatureVerified = verifyMidtransNotificationSignature(notification, env);
  if (!signatureVerified) {
    throw toMidtransError("Signature webhook Midtrans tidak valid.", 401);
  }

  const status = await getMidtransTransactionStatus(orderId, env);
  const outcome = getMidtransTransactionOutcome(status.transactionStatus, status.fraudStatus);
  const ledger = await upsertPaymentLedgerEntry(
    buildWebhookLedgerEntry({ notification, status, outcome }),
    env
  );

  return {
    ok: true,
    verified: true,
    orderId: status.orderId,
    transactionStatus: status.transactionStatus,
    fraudStatus: status.fraudStatus,
    paymentType: status.paymentType,
    statusCode: status.statusCode,
    transactionState: outcome.transactionState,
    shouldGrantAccess: outcome.shouldGrantAccess,
    message: outcome.reason,
    ledger,
    raw: status.raw,
  };
}
