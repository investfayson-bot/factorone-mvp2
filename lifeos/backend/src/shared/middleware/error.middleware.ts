import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { AppError } from "../../core/errors/app-error";
import { logger } from "../../core/logger";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found"
    }
  });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.flatten()
      }
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(409).json({
      error: {
        code: "DATABASE_CONFLICT",
        message: err.message,
        details: {
          target: err.meta
        }
      }
    });
  }

  logger.error("Unexpected error", err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong"
    }
  });
};
