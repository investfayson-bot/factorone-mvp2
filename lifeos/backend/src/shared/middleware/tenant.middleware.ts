import { NextFunction, Request, Response } from "express";

import { prisma } from "../../config/prisma";
import { AppError } from "../../core/errors/app-error";

export const requireTenantAccess = async (req: Request, _res: Response, next: NextFunction) => {
  const tenantId = req.header("x-tenant-id");

  if (!tenantId) {
    return next(new AppError(400, "x-tenant-id header is required", "TENANT_REQUIRED"));
  }

  if (!req.auth?.userId) {
    return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: req.auth.userId,
        tenantId
      }
    }
  });

  if (!membership) {
    return next(new AppError(403, "No access to tenant", "TENANT_FORBIDDEN"));
  }

  req.tenantId = tenantId;
  return next();
};
