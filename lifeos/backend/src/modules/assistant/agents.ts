import { AgentType, UserMode } from "@prisma/client";

export type AgentExecutionInput = {
  message: string;
  mode: UserMode;
  intent: string;
  profileType?: string;
};

type AgentResult = {
  reply: string;
  actionHint: string;
};

type AgentHandler = (input: AgentExecutionInput) => Promise<AgentResult>;

const handlers: Record<AgentType, AgentHandler> = {
  [AgentType.FINANCE]: async ({ message }) => ({
    reply: `FinanceAgent analyzed your request: "${message}". I can create expenses, set bill reminders, and suggest budget categories.`,
    actionHint: "Use /tasks with type=EXPENSE or REMINDER for persistence."
  }),
  [AgentType.CRM]: async ({ message }) => ({
    reply: `CRMAgent is ready. For "${message}", I can register clients, track stage, and schedule follow-ups.`,
    actionHint: "Use /crm/clients and /crm/clients/:id/follow-ups endpoints."
  }),
  [AgentType.MARKETING]: async ({ message, profileType }) => ({
    reply: `MarketingAgent drafted a positioning angle for ${profileType ?? "your business"}: ${message}`,
    actionHint: "Next step: plug OpenAI provider to generate channel-specific variants."
  }),
  [AgentType.CALENDAR]: async ({ message }) => ({
    reply: `CalendarAgent can transform "${message}" into an appointment task with date/time constraints.`,
    actionHint: "Persist appointment intents in /tasks with type=APPOINTMENT."
  }),
  [AgentType.REMINDER]: async ({ message }) => ({
    reply: `ReminderAgent captured reminder intent from "${message}" and can track due date + status.`,
    actionHint: "Store recurring reminders in metadata (interval, channel)."
  }),
  [AgentType.GENERAL]: async ({ message, mode }) => ({
    reply: `GeneralAgent (${mode}) received: "${message}". I can route this to a specialist agent when intent confidence increases.`,
    actionHint: "Capture user feedback to improve routing confidence."
  })
};

export const runAgent = async (agentType: AgentType, input: AgentExecutionInput): Promise<AgentResult> => {
  return handlers[agentType](input);
};
