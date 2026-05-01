"use client";

import { useState } from "react";

import { sendChat } from "@/lib/api";

type Message = {
  id: string;
  from: "user" | "assistant";
  text: string;
  agent?: string;
};

type ChatPanelProps = {
  token: string;
  tenantId: string;
  mode: "PERSONAL" | "PROFESSIONAL";
};

export function ChatPanel({ token, tenantId, mode }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitMessage = async () => {
    if (!message.trim()) {
      return;
    }

    const current = message.trim();
    setMessage("");
    setError(null);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), from: "user", text: current }]);

    try {
      setLoading(true);
      const response = await sendChat({
        token,
        tenantId,
        message: current,
        mode,
        conversationId
      });

      setConversationId(response.data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: "assistant",
          text: response.data.assistant.reply,
          agent: response.data.assistant.agentType
        }
      ]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="chat-panel">
      <h2>AI Assistant</h2>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="placeholder">Start by asking LifeOS to add an expense, reminder, or CRM follow-up.</p>
        )}
        {messages.map((item) => (
          <div key={item.id} className={`bubble ${item.from}`}>
            <p>{item.text}</p>
            {item.agent ? <span className="agent-label">Agent: {item.agent}</span> : null}
          </div>
        ))}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="chat-input-row">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="e.g. Remind me to pay internet bill on Monday"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitMessage();
            }
          }}
        />
        <button type="button" onClick={() => void submitMessage()} disabled={loading || !token || !tenantId}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </section>
  );
}
