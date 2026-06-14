import { createPublishedReaderFileUrl } from "../../server/readerAccess.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const ebookId = String(req.query?.ebookId || "");
    const result = await createPublishedReaderFileUrl(
      {
        ebookId,
        headers: req.headers,
      },
      process.env
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Gagal menyiapkan file baca e-book.",
    });
  }
}
