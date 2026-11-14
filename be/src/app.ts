import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { errorHandler } from "./lib/errors";
import { DOCS_CSS, openApiDocument } from "./lib/openapi";
import { TUTORIAL_DIR } from "./lib/tutorial";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()) }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api", apiRouter());
  // Video tutorial per latihan (web siswa + aplikasi orang tua). express.static mendukung Range untuk video.
  app.use("/tutorial", express.static(TUTORIAL_DIR, { maxAge: "7d", fallthrough: true }));
  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument());
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: "SATU API",
      customCss: DOCS_CSS,
      swaggerOptions: {
        url: "/openapi.json",
        persistAuthorization: true, // token survives a page refresh
        docExpansion: "list",
        filter: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: -1, // hide the schema dump at the bottom
      },
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ detail: "Endpoint tidak ditemukan" });
  });
  app.use(errorHandler);
  return app;
}
