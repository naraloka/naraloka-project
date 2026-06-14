import { createMidtransTransaction } from "../../server/midtrans.js";
import { requireAuthenticatedUser } from "../../server/auth.js";
import { resolveTrustedCheckoutPayload } from "../../server/checkoutSecurity.js";

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
    const body = event.body ? JSON.parse(event.body) : {};
    const authUser = await requireAuthenticatedUser(event.headers, process.env);
    const trustedPayload = await resolveTrustedCheckoutPayload(
      {
        ...body,
        authUser,
      },
      process.env
    );
    const result = await createMidtransTransaction(trustedPayload, process.env);

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
        message: error.message || "Gagal membuat token Midtrans.",
      }),
    };
  }
}
