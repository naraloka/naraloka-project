import { handleMidtransNotification } from "../../server/midtrans.js";

function getJsonBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = await getJsonBody(req);
    const result = await handleMidtransNotification(body, process.env);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Gagal memproses webhook Midtrans.",
    });
  }
}
