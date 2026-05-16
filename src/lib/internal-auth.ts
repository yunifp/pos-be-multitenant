// src/lib/internal-auth.ts
import { createHmac } from "crypto";

export function generateInternalToken(slug: string): string {
  const SECRET = process.env.INTERNAL_API_SECRET;

  if (!SECRET) {
    throw new Error("FATAL: INTERNAL_API_SECRET is not defined in .env");
  }

  const timestamp = Date.now();
  const payload = `${slug}:${timestamp}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}
