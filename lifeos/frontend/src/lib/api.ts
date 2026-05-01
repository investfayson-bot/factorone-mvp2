const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type ChatMode = "PERSONAL" | "PROFESSIONAL";

export type ChatResponse = {
  data: {
    conversationId: string;
    route: {
      intent: string;
      agentType: string;
      confidence: number;
      reasons: string[];
    };
    assistant: {
      agentType: string;
      reply: string;
      actionHint: string;
    };
  };
};

export const sendChat = async (params: {
  token: string;
  tenantId: string;
  message: string;
  mode: ChatMode;
  conversationId?: string;
}): Promise<ChatResponse> => {
  const response = await fetch(`${API_BASE}/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
      "x-tenant-id": params.tenantId
    },
    body: JSON.stringify({
      message: params.message,
      mode: params.mode,
      conversationId: params.conversationId
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Failed to send message");
  }

  return (await response.json()) as ChatResponse;
};
