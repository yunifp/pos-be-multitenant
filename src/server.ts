// src/app.ts
import express from "express";
import cors from "cors";
import mainRouter from "./routes";
import { tenantMiddleware } from "./middlewares/tenant.middleware";

const app = express();

app.use(cors());
app.use(express.json());
app.use(tenantMiddleware);

// Load semua routes
app.use("/api/v1", mainRouter);

app.listen(3000, () => {
  console.log("🚀 Server berjalan di http://localhost:3000");
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("============= [GLOBAL ERROR INTERCEPTOR] =============");
    console.error("Penyebab Error Sebenarnya:");
    console.error(err); // Ini akan mencetak stack trace, file mana, dan baris keberapa yang hancur
    console.error("======================================================");

    res.status(500).json({
      success: false,
      message: "Internal server error (Caught by Global Handler)",
      error: err.message,
    });
  },
);
