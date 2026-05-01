import { AgentType, UserMode } from "@prisma/client";

type IntentRouteInput = {
  message: string;
  mode: UserMode;
  profileType?: string;
};

export type RoutedIntent = {
  intent: string;
  agentType: AgentType;
  confidence: number;
  reasons: string[];
};

const containsAny = (source: string, terms: string[]): boolean => {
  return terms.some((term) => source.includes(term));
};

export const routeIntent = ({ message, mode, profileType }: IntentRouteInput): RoutedIntent => {
  const normalized = message.toLowerCase();
  const reasons: string[] = [];

  if (containsAny(normalized, ["expense", "bill", "subscription", "cashflow", "budget", "finance", "payment"])) {
    reasons.push("Detected finance keywords");
    return {
      intent: "FINANCE_MANAGEMENT",
      agentType: AgentType.FINANCE,
      confidence: 0.88,
      reasons
    };
  }

  if (containsAny(normalized, ["client", "lead", "follow-up", "follow up", "pipeline", "crm"])) {
    reasons.push("Detected CRM keywords");
    return {
      intent: "CRM_MANAGEMENT",
      agentType: AgentType.CRM,
      confidence: 0.9,
      reasons
    };
  }

  if (containsAny(normalized, ["post", "caption", "script", "marketing", "campaign", "instagram"])) {
    reasons.push("Detected marketing generation request");
    return {
      intent: "MARKETING_CONTENT",
      agentType: AgentType.MARKETING,
      confidence: 0.86,
      reasons
    };
  }

  if (containsAny(normalized, ["appointment", "calendar", "meeting", "agenda", "schedule"])) {
    reasons.push("Detected calendar terms");
    return {
      intent: "CALENDAR_MANAGEMENT",
      agentType: AgentType.CALENDAR,
      confidence: 0.84,
      reasons
    };
  }

  if (containsAny(normalized, ["remind", "reminder", "due", "notify", "alert"])) {
    reasons.push("Detected reminder intent");
    return {
      intent: "REMINDER_MANAGEMENT",
      agentType: AgentType.REMINDER,
      confidence: 0.83,
      reasons
    };
  }

  reasons.push(`Fallback for mode ${mode}`);
  if (profileType) {
    reasons.push(`Profile type context: ${profileType}`);
  }

  return {
    intent: "GENERAL_ASSISTANCE",
    agentType: AgentType.GENERAL,
    confidence: 0.6,
    reasons
  };
};
