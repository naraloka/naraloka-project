import { listAdminUsers, updateAdminUserStatus } from "../../../server/adminUsers.js";

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
  if (req.method === "GET") {
    try {
      const result = await listAdminUsers({ headers: req.headers }, process.env);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Gagal mengambil data pengguna admin.",
      });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await getJsonBody(req);
      const result = await updateAdminUserStatus(
        {
          headers: req.headers,
          userId: body.userId,
          action: body.action,
        },
        process.env
      );
      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Gagal memperbarui status pengguna admin.",
      });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
