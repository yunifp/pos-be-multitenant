// src/app.ts
import express from "express";
import cors from "cors";
import mainRouter from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

// Load semua routes
app.use("/api/v1", mainRouter);

app.listen(3000, () => {
  console.log("🚀 Server berjalan di http://localhost:3000");
});
