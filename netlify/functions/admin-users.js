import { listAdminUsers, updateAdminUserStatus } from "../../server/adminUsers.js";

export async function handler(event) {
  if (event.httpMethod === "GET") {
    try {
      const result = await listAdminUsers({ headers: event.headers }, process.env);
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
          message: error.message || "Gagal mengambil data pengguna admin.",
        }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await updateAdminUserStatus(
        {
          headers: event.headers,
          userId: body.userId,
          action: body.action,
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
          message: error.message || "Gagal memperbarui status pengguna admin.",
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
