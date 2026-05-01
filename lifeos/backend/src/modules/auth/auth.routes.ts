import { MembershipRole, UserMode } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma";
import { AppError } from "../../core/errors/app-error";
import { asyncHandler } from "../../shared/utils/async-handler";
import { classifyProfessionalProfile } from "../../shared/utils/classify-profile";
import { signAuthToken } from "../../shared/utils/jwt";
import { comparePassword, hashPassword } from "../../shared/utils/password";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  tenantName: z.string().min(2).optional(),
  professionalDescription: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 32);

const buildUniqueSlug = (base: string): string => {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slugify(base)}-${suffix}`;
};

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (existingUser) {
      throw new AppError(409, "Email already registered", "EMAIL_CONFLICT");
    }

    const passwordHash = await hashPassword(body.password);
    const professionalType = classifyProfessionalProfile(body.professionalDescription);

    const tenantName = body.tenantName ?? `${body.firstName}'s workspace`;
    const tenantSlug = buildUniqueSlug(tenantName || body.email.split("@")[0]);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName
        }
      });

      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug
        }
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: MembershipRole.OWNER
        }
      });

      await tx.profile.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          mode: UserMode.PERSONAL,
          displayName: `${body.firstName}${body.lastName ? ` ${body.lastName}` : ""}`.trim(),
          locale: "en-US",
          timezone: "UTC"
        }
      });

      await tx.profile.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          mode: UserMode.PROFESSIONAL,
          displayName: tenantName,
          professionalType,
          professionalDescription: body.professionalDescription,
          locale: "en-US",
          timezone: "UTC"
        }
      });

      return { user, tenant };
    });

    const token = signAuthToken({
      sub: result.user.id,
      email: result.user.email
    });

    res.status(201).json({
      data: {
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        },
        defaultTenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug
        }
      }
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: {
        memberships: {
          include: {
            tenant: true
          }
        }
      }
    });

    if (!user) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const isValidPassword = await comparePassword(body.password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const token = signAuthToken({
      sub: user.id,
      email: user.email
    });

    res.status(200).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        tenants: user.memberships.map((membership) => ({
          id: membership.tenant.id,
          name: membership.tenant.name,
          slug: membership.tenant.slug,
          role: membership.role
        }))
      }
    });
  })
);
