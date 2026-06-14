import { getMidtransTransactionStatus } from "../../server/midtrans.js";
import { assertPaymentLedgerOwnership, requireAuthenticatedUser } from "../../server/auth.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  try {
    const authUser = await requireAuthenticatedUser(event.headers, process.env);
    const orderId = event.queryStringParameters?.orderId || "";
    await assertPaymentLedgerOwnership({ orderId, userId: authUser.id }, process.env);
    const result = await getMidtransTransactionStatus(orderId, process.env);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: error.message || "Gagal memeriksa status Midtrans.",
      }),
    };
  }
}
