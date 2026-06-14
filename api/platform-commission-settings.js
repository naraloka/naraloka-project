import {
  fetchPlatformCommissionSettings,
  savePlatformCommissionSettings,
} from "../../server/platformCommissionSettings.js";

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
      const settings = await fetchPlatformCommissionSettings(process.env);
      return res.status(200).json({ settings });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Gagal mengambil pengaturan komisi platform.",
      });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await getJsonBody(req);
      const result = await savePlatformCommissionSettings(
        {
          headers: req.headers,
          settings: body.settings,
        },
        process.env
      );
      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Gagal menyimpan pengaturan komisi platform.",
      });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
