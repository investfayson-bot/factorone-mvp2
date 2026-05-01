import { Router } from "express";

import { assistantRouter } from "./modules/assistant/assistant.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { crmRouter } from "./modules/crm/crm.routes";
import { profileRouter } from "./modules/profiles/profile.routes";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { authenticate } from "./shared/middleware/auth.middleware";
import { requireTenantAccess } from "./shared/middleware/tenant.middleware";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    data: {
      service: "lifeos-backend",
      status: "ok"
    }
  });
});

apiRouter.use("/auth", authRouter);

apiRouter.use(authenticate);
apiRouter.use(requireTenantAccess);

apiRouter.use("/profile", profileRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/crm", crmRouter);
