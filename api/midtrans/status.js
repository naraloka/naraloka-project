import { getMidtransTransactionStatus } from "../../server/midtrans.js";
import { assertPaymentLedgerOwnership, requireAuthenticatedUser } from "../../server/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const authUser = await requireAuthenticatedUser(req.headers, process.env);
    const orderId = String(req.query?.orderId || "");
    await assertPaymentLedgerOwnership({ orderId, userId: authUser.id }, process.env);
    const result = await getMidtransTransactionStatus(orderId, process.env);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Gagal memeriksa status Midtrans.",
    });
  }
}
