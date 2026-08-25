import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pool from "./config/db.js";
import useRoutes from "./routes/userRoutes.js";
import errorHandling from "./middlewares/errorHandler.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const monitoringDirectory = path.resolve(
  currentDirectory,
  "../public/monitoring",
);

export const getAllowedOrigins = (environment = process.env) => {
  const configuredOrigins =
    environment.FRONTEND_ORIGINS ||
    environment.FRONTEND_ORIGIN ||
    "http://localhost:3000";

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const createApiCors = (allowedOrigins) => {
  const allowedOriginSet = new Set(allowedOrigins);

  return cors({
    origin(origin, callback) {
      if (!origin || allowedOriginSet.has(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin is not allowed");
      error.status = 403;
      return callback(error);
    },
  });
};

export const createApp = ({ allowedOrigins = getAllowedOrigins() } = {}) => {
  const app = express();

  app.use(helmet());

  app.use(
    "/monitoring",
    express.static(monitoringDirectory, {
      etag: true,
      lastModified: true,
      maxAge: 0,
      setHeaders(response) {
        response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    }),
  );

  app.use(express.json({ limit: Infinity }));
  app.use("/api", createApiCors(allowedOrigins), useRoutes);

  app.get("/", async (_request, response, next) => {
    try {
      const result = await pool.query("SELECT current_database()");
      return response.send(
        `Connected to database: ${result.rows[0].current_database}`,
      );
    } catch (error) {
      return next(error);
    }
  });

  app.use(errorHandling);

  return app;
};
