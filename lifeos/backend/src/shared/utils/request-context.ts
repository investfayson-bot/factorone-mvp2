import { Request } from "express";

import { AppError } from "../../core/errors/app-error";

export const requireAuthContext = (req: Request) => {
  if (!req.auth) {
    throw new AppError(401, "Authentication required", "UNAUTHORIZED");
  }

  return req.auth;
};

export const requireTenantContext = (req: Request): string => {
  if (!req.tenantId) {
    throw new AppError(400, "Tenant context missing", "TENANT_REQUIRED");
  }

  return req.tenantId;
};
