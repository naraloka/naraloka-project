import { syncMembershipRoyaltyLedgerForUser } from "../../server/membershipRoyaltyLedger.js";
import { requireAuthenticatedUser } from "../../server/auth.js";

async function getJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const authUser = await requireAuthenticatedUser(req.headers, process.env);
    const body = await getJsonBody(req);
    const userId = String(body.userId || "").trim();
    if (!userId || userId !== authUser.id) {
      return res.status(403).json({
        message: "Sinkronisasi membership royalty hanya boleh untuk akun sendiri.",
      });
    }
    const result = await syncMembershipRoyaltyLedgerForUser(userId, process.env);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Gagal menyinkronkan membership royalty pool.",
    });
  }
}
