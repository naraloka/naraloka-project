import { syncMembershipRoyaltyLedgerForUser } from "../../server/membershipRoyaltyLedger.js";
import { requireAuthenticatedUser } from "../../server/auth.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
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
    const body = event.body ? JSON.parse(event.body) : {};
    const userId = String(body.userId || "").trim();
    if (!userId || userId !== authUser.id) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Sinkronisasi membership royalty hanya boleh untuk akun sendiri.",
        }),
      };
    }
    const result = await syncMembershipRoyaltyLedgerForUser(userId, process.env);
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
        message: error.message || "Gagal menyinkronkan membership royalty pool.",
      }),
    };
  }
}
