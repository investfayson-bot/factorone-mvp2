import { UserMode } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../shared/utils/async-handler";
import { classifyProfessionalProfile } from "../../shared/utils/classify-profile";
import { requireAuthContext, requireTenantContext } from "../../shared/utils/request-context";

const modeQuerySchema = z.object({
  mode: z.nativeEnum(UserMode).optional().default(UserMode.PERSONAL)
});

const updateProfileSchema = z.object({
  mode: z.nativeEnum(UserMode),
  displayName: z.string().min(1).optional(),
  professionalType: z.string().min(1).optional(),
  professionalDescription: z.string().min(1).optional(),
  locale: z.string().min(2).optional(),
  timezone: z.string().min(2).optional()
});

export const profileRouter = Router();

profileRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const query = modeQuerySchema.parse(req.query);

    const profile = await prisma.profile.findUnique({
      where: {
        userId_tenantId_mode: {
          userId: auth.userId,
          tenantId,
          mode: query.mode
        }
      }
    });

    res.status(200).json({ data: profile });
  })
);

profileRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const body = updateProfileSchema.parse(req.body);

    const professionalType = body.professionalDescription
      ? classifyProfessionalProfile(body.professionalDescription)
      : body.professionalType;

    const profile = await prisma.profile.upsert({
      where: {
        userId_tenantId_mode: {
          userId: auth.userId,
          tenantId,
          mode: body.mode
        }
      },
      create: {
        userId: auth.userId,
        tenantId,
        mode: body.mode,
        displayName: body.displayName ?? "LifeOS User",
        professionalType,
        professionalDescription: body.professionalDescription,
        locale: body.locale ?? "en-US",
        timezone: body.timezone ?? "UTC"
      },
      update: {
        displayName: body.displayName,
        professionalType,
        professionalDescription: body.professionalDescription,
        locale: body.locale,
        timezone: body.timezone
      }
    });

    res.status(200).json({ data: profile });
  })
);
