import { describe, expect, it } from "vitest";
import {
  computeMidtransNotificationSignature,
  getMidtransTransactionOutcome,
  verifyMidtransNotificationSignature,
} from "./midtrans.js";

const env = {
  MIDTRANS_ENV: "sandbox",
  MIDTRANS_SERVER_KEY: "midtrans-server-test-key",
};

describe("Midtrans webhook helpers", () => {
  it("membuat dan memverifikasi signature webhook Midtrans", () => {
    const payload = {
      order_id: "ORDER-123",
      status_code: "200",
      gross_amount: "49000.00",
    };

    const signature = computeMidtransNotificationSignature(payload, env);

    expect(signature).toHaveLength(128);
    expect(
      verifyMidtransNotificationSignature(
        {
          ...payload,
          signature_key: signature,
        },
        env
      )
    ).toBe(true);
  });

  it("menolak signature webhook yang tidak cocok", () => {
    expect(
      verifyMidtransNotificationSignature(
        {
          order_id: "ORDER-123",
          status_code: "200",
          gross_amount: "49000.00",
          signature_key: "invalid-signature",
        },
        env
      )
    ).toBe(false);
  });

  it("mengubah status Midtrans menjadi outcome aplikasi", () => {
    expect(getMidtransTransactionOutcome("settlement")).toMatchObject({
      transactionState: "SUCCESS",
      shouldGrantAccess: true,
    });

    expect(getMidtransTransactionOutcome("capture", "challenge")).toMatchObject({
      transactionState: "PENDING",
      shouldGrantAccess: false,
    });

    expect(getMidtransTransactionOutcome("deny")).toMatchObject({
      transactionState: "FAILED",
      shouldGrantAccess: false,
    });
  });
});
