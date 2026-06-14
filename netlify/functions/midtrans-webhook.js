import { handleMidtransNotification } from "../../server/midtrans.js";

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
    const result = await handleMidtransNotification(body, process.env);

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
        message: error.message || "Gagal memproses webhook Midtrans.",
      }),
    };
  }
}
