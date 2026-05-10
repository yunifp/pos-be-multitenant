// src/types/express.d.ts
import { User, Tenant, Branch } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        branchId: string | null;
        roleId: string;
        email: string;
      };
    }
  }
}
