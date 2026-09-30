import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import helmet from "helmet";
import type { ErrorRequestHandler } from "express";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet());
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }

  try {
    if (new URL(origin).host !== req.get("host")) {
      res.status(403).json({ error: "Cross-origin request rejected" });
      return;
    }
  } catch {
    res.status(403).json({ error: "Invalid request origin" });
    return;
  }
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof Error && error.name === "MulterError") {
    const statusCode = "code" in error && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(statusCode).json({
      error: statusCode === 413 ? "Image must be 10 MB or smaller." : "Invalid image upload.",
    });
    return;
  }
  req.log.error({ err: error }, "Unhandled API error");
  res.status(500).json({ error: "The request could not be completed." });
};
app.use(errorHandler);

export default app;
