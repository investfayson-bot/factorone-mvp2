import { MessageRole, UserMode } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma";
import { AppError } from "../../core/errors/app-error";
import { asyncHandler } from "../../shared/utils/async-handler";
import { requireAuthContext, requireTenantContext } from "../../shared/utils/request-context";
import { routeIntent } from "../ai-routing/intent-router";
import { runAgent } from "./agents";

const chatSchema = z.object({
  message: z.string().min(1),
  mode: z.nativeEnum(UserMode).default(UserMode.PERSONAL),
  conversationId: z.string().cuid().optional()
});
const conversationParamsSchema = z.object({
  conversationId: z.string().cuid()
});

export const assistantRouter = Router();

assistantRouter.post(
  "/chat",
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);

    const profile = await prisma.profile.findUnique({
      where: {
        userId_tenantId_mode: {
          userId: auth.userId,
          tenantId,
          mode: body.mode
        }
      }
    });

    let conversation = body.conversationId
      ? await prisma.conversation.findFirst({
          where: {
            id: body.conversationId,
            tenantId,
            userId: auth.userId
          }
        })
      : null;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          userId: auth.userId,
          mode: body.mode
        }
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: body.message
      }
    });

    const routed = routeIntent({
      message: body.message,
      mode: body.mode,
      profileType: profile?.professionalType ?? undefined
    });

    const agentResult = await runAgent(routed.agentType, {
      message: body.message,
      mode: body.mode,
      intent: routed.intent,
      profileType: profile?.professionalType ?? undefined
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        agentType: routed.agentType,
        content: agentResult.reply
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastAgentType: routed.agentType
      }
    });

    res.status(200).json({
      data: {
        conversationId: conversation.id,
        route: routed,
        assistant: {
          agentType: routed.agentType,
          reply: agentResult.reply,
          actionHint: agentResult.actionHint
        }
      }
    });
  })
);

assistantRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        userId: auth.userId
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 20
    });

    res.status(200).json({ data: conversations });
  })
);

assistantRouter.get(
  "/conversations/:conversationId/messages",
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req);
    const tenantId = requireTenantContext(req);
    const params = conversationParamsSchema.parse(req.params);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        tenantId,
        userId: auth.userId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!conversation) {
      throw new AppError(404, "Conversation not found", "NOT_FOUND");
    }

    res.status(200).json({ data: conversation.messages });
  })
);
