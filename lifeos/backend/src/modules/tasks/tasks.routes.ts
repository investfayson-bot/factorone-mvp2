import { Prisma, TaskStatus, TaskType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma";
import { AppError } from "../../core/errors/app-error";
import { asyncHandler } from "../../shared/utils/async-handler";
import { requireAuthContext, requireTenantContext } from "../../shared/utils/request-context";

const listQuerySchema = z.object({
  type: z.nativeEnum(TaskType).optional(),
  status: z.nativeEnum(TaskStatus).optional()
});

const createTaskSchema = z.object({
  type: z.nativeEnum(TaskType),
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.any()).optional()
});
const taskParamsSchema = z.object({
  taskId: z.string().cuid()
});

export const tasksRouter = Router();

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const query = listQuerySchema.parse(req.query);

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        userId: auth.userId,
        type: query.type,
        status: query.status
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({ data: tasks });
  })
);

tasksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const body = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        tenantId,
        userId: auth.userId,
        type: body.type,
        status: body.status ?? TaskStatus.PENDING,
        title: body.title,
        description: body.description,
        amount: body.amount ? new Prisma.Decimal(body.amount) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        metadata: body.metadata
      }
    });

    res.status(201).json({ data: task });
  })
);

tasksRouter.patch(
  "/:taskId",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const body = updateTaskSchema.parse(req.body);
    const params = taskParamsSchema.parse(req.params);

    const existing = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        tenantId,
        userId: auth.userId
      }
    });

    if (!existing) {
      throw new AppError(404, "Task not found", "NOT_FOUND");
    }

    const task = await prisma.task.update({
      where: {
        id: params.taskId
      },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        amount: body.amount ? new Prisma.Decimal(body.amount) : undefined,
        dueDate: body.dueDate === null ? null : body.dueDate ? new Date(body.dueDate) : undefined,
        scheduledAt:
          body.scheduledAt === null ? null : body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        metadata: body.metadata
      }
    });

    res.status(200).json({ data: task });
  })
);
