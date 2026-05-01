import { ClientStage, FollowUpStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma";
import { AppError } from "../../core/errors/app-error";
import { asyncHandler } from "../../shared/utils/async-handler";
import { requireAuthContext, requireTenantContext } from "../../shared/utils/request-context";

const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
  notes: z.string().optional(),
  stage: z.nativeEnum(ClientStage).optional()
});

const createFollowUpSchema = z.object({
  dueDate: z.string().datetime(),
  note: z.string().optional(),
  status: z.nativeEnum(FollowUpStatus).optional()
});
const clientParamsSchema = z.object({
  clientId: z.string().cuid()
});

export const crmRouter = Router();

crmRouter.get(
  "/clients",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);

    const clients = await prisma.client.findMany({
      where: {
        tenantId,
        ownerId: auth.userId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({ data: clients });
  })
);

crmRouter.post(
  "/clients",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const body = createClientSchema.parse(req.body);

    const client = await prisma.client.create({
      data: {
        tenantId,
        ownerId: auth.userId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        stage: body.stage ?? ClientStage.LEAD
      }
    });

    res.status(201).json({ data: client });
  })
);

crmRouter.get(
  "/clients/:clientId/follow-ups",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const params = clientParamsSchema.parse(req.params);

    const followUps = await prisma.followUp.findMany({
      where: {
        tenantId,
        ownerId: auth.userId,
        clientId: params.clientId
      },
      orderBy: {
        dueDate: "asc"
      }
    });

    res.status(200).json({ data: followUps });
  })
);

crmRouter.post(
  "/clients/:clientId/follow-ups",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const body = createFollowUpSchema.parse(req.body);
    const params = clientParamsSchema.parse(req.params);

    const client = await prisma.client.findFirst({
      where: {
        id: params.clientId,
        tenantId,
        ownerId: auth.userId
      }
    });

    if (!client) {
      throw new AppError(404, "Client not found", "NOT_FOUND");
    }

    const followUp = await prisma.followUp.create({
      data: {
        tenantId,
        ownerId: auth.userId,
        clientId: client.id,
        dueDate: new Date(body.dueDate),
        note: body.note,
        status: body.status ?? FollowUpStatus.TODO
      }
    });

    res.status(201).json({ data: followUp });
  })
);
