import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { createMidtransTransaction } from "./server/midtrans.js";

function readJsonBody(req: NodeJS.ReadableStream) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
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

function midtransDevApiPlugin() {
  return {
    name: "midtrans-dev-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/midtrans/token", async (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        try {
          const body = await readJsonBody(req);
          const result = await createMidtransTransaction(body, process.env);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = Number((error as { statusCode?: number }).statusCode) || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : "Gagal membuat token Midtrans.",
            })
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    midtransDevApiPlugin()
  ],
})
