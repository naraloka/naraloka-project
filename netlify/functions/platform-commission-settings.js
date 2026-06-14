import {
  fetchPlatformCommissionSettings,
  savePlatformCommissionSettings,
} from "../../server/platformCommissionSettings.js";

export async function handler(event) {
  if (event.httpMethod === "GET") {
    try {
      const settings = await fetchPlatformCommissionSettings(process.env);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings }),
      };
    } catch (error) {
      return {
        statusCode: error.statusCode || 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: error.message || "Gagal mengambil pengaturan komisi platform.",
        }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await savePlatformCommissionSettings(
        {
          headers: event.headers,
          settings: body.settings,
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
          message: error.message || "Gagal menyimpan pengaturan komisi platform.",
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "Method not allowed" }),
  };
}
