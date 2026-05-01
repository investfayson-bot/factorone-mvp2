"use client";

import { useState } from "react";

import { ChatPanel } from "@/components/chat-panel";
import { ModeTabs } from "@/components/mode-tabs";

export default function HomePage() {
  const [uiMode, setUiMode] = useState<"PERSONAL" | "PROFESSIONAL" | "CRM">("PERSONAL");
  const [token, setToken] = useState("");
  const [tenantId, setTenantId] = useState("");

  return (
    <main className="container">
      <header>
        <h1>LifeOS Dashboard</h1>
        <p>Unified personal + professional AI assistant MVP</p>
      </header>

      <section className="card auth-card">
        <h2>MVP Auth Context</h2>
        <p>After login/register in backend APIs, paste token and tenantId here.</p>
        <div className="input-grid">
          <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="JWT token" />
          <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} placeholder="Tenant ID" />
        </div>
      </section>

      <section className="card">
        <ModeTabs value={uiMode} onChange={setUiMode} />
      </section>

      <section className="dashboard-grid">
        <ChatPanel token={token} tenantId={tenantId} mode={uiMode === "CRM" ? "PROFESSIONAL" : uiMode} />

        <aside className="card side-panel">
          <h2>{uiMode} Tools</h2>
          {uiMode === "PERSONAL" ? (
            <ul>
              <li>Track expenses and recurring bills</li>
              <li>Appointments and reminders</li>
              <li>Personal productivity prompts</li>
            </ul>
          ) : null}

          {uiMode === "PROFESSIONAL" ? (
            <ul>
              <li>Business finances and schedules</li>
              <li>Generate marketing captions/scripts</li>
              <li>Auto professional profile classification</li>
            </ul>
          ) : null}

          {uiMode === "CRM" ? (
            <ul>
              <li>Lead/client pipeline overview</li>
              <li>Follow-up reminders by due date</li>
              <li>Conversation notes and next actions</li>
            </ul>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
