import { createPublishedReaderFileUrl } from "../../server/readerAccess.js";

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
    const ebookId = String(event.queryStringParameters?.ebookId || "");
    const result = await createPublishedReaderFileUrl(
      {
        ebookId,
        headers: event.headers,
      },
      process.env
    );

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
        message: error.message || "Gagal menyiapkan file baca e-book.",
      }),
    };
  }
}
