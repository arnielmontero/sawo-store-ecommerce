import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./lib/env";
import { UPLOAD_DIR } from "./lib/upload";
import { authRouter } from "./routes/auth.routes";
import { ordersRouter } from "./routes/orders.routes";
import { productsRouter } from "./routes/products.routes";
import { inventoryRouter } from "./routes/inventory.routes";
import { paymentsRouter } from "./routes/payments.routes";
import { customersRouter } from "./routes/customers.routes";
import { shippingRouter } from "./routes/shipping.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { settingsRouter } from "./routes/settings.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { questionsRouter, reviewsRouter } from "./routes/reviews.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));

// Stripe webhook needs the raw, unparsed body to verify its signature, so
// this is registered BEFORE express.json() and scoped to only this path —
// every other route still gets normal JSON parsing.
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(cookieParser());

// Serves uploaded product images back out. crossOriginResourcePolicy is
// relaxed only for this path — helmet's default ("same-origin") would
// otherwise block the frontend (a different origin/port) from loading them.
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
  })
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/customers", customersRouter);
app.use("/api/v1/shipping", shippingRouter);
app.use("/api/v1/settings", settingsRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/reviews", reviewsRouter);
app.use("/api/v1/questions", questionsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
