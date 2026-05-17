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
