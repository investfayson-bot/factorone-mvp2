import { NextFunction, Request, Response } from "express";

import { AppError } from "../../core/errors/app-error";
import { verifyAuthToken } from "../utils/jwt";

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing bearer token", "UNAUTHORIZED"));
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = verifyAuthToken(token);
    req.auth = { userId: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(new AppError(401, "Invalid token", "UNAUTHORIZED"));
  }
};
