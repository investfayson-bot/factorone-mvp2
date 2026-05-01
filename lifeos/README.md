# LifeOS MVP Scaffold

LifeOS is an AI-powered personal assistant + CRM + financial assistant foundation.
This scaffold is designed for a **local-first MVP** that can evolve into a SaaS multi-tenant platform.

## 1) Folder Structure

```text
lifeos/
├── .gitignore
├── package.json                      # npm workspaces (backend + frontend)
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts                  # bootstrap server
│       ├── app.ts                    # express app config
│       ├── routes.ts                 # API v1 route mount
│       ├── config/
│       │   ├── env.ts                # env parsing (zod)
│       │   └── prisma.ts             # prisma singleton client
│       ├── core/
│       │   ├── errors/app-error.ts
│       │   ├── http/response.ts
│       │   └── logger/index.ts
│       ├── shared/
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── tenant.middleware.ts
│       │   │   └── error.middleware.ts
│       │   └── utils/
│       │       ├── async-handler.ts
│       │       ├── classify-profile.ts
│       │       ├── jwt.ts
│       │       ├── password.ts
│       │       └── request-context.ts
│       ├── modules/
│       │   ├── auth/auth.routes.ts
│       │   ├── profiles/profile.routes.ts
│       │   ├── assistant/
│       │   │   ├── assistant.routes.ts
│       │   │   └── agents.ts
│       │   ├── ai-routing/intent-router.ts
│       │   ├── tasks/tasks.routes.ts
│       │   └── crm/crm.routes.ts
│       └── types/express.d.ts
└── frontend/
    ├── .env.local.example
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── next-env.d.ts
    └── src/
        ├── app/
        │   ├── globals.css
        │   ├── layout.tsx
        │   └── page.tsx
        ├── components/
        │   ├── chat-panel.tsx
        │   └── mode-tabs.tsx
        └── lib/api.ts
```

---

## 2) Backend (Node.js + TypeScript + Prisma + JWT)

### Core Architecture Choices

- **Express REST API** with modular route boundaries
- **Prisma + PostgreSQL** as persistence layer
- **JWT auth** for MVP speed
- **Multi-tenant context** via `x-tenant-id` header + membership validation
- **Agent-based assistant architecture**:
  - `FinanceAgent`
  - `CRMAgent`
  - `MarketingAgent`
  - `CalendarAgent`
  - `ReminderAgent`
  - `GeneralAgent`
- **AI routing layer** (`modules/ai-routing/intent-router.ts`) that decides which agent handles each message

### Key MVP Endpoints

#### Auth + User/Tenant bootstrap
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

#### Profile management (Personal/Professional mode)
- `GET /api/v1/profile/me?mode=PERSONAL|PROFESSIONAL`
- `PATCH /api/v1/profile/me`

#### Assistant core API
- `POST /api/v1/assistant/chat`
- `GET /api/v1/assistant/conversations`
- `GET /api/v1/assistant/conversations/:conversationId/messages`

#### Task system (expenses/reminders/appointments)
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `PATCH /api/v1/tasks/:taskId`

#### CRM module
- `GET /api/v1/crm/clients`
- `POST /api/v1/crm/clients`
- `GET /api/v1/crm/clients/:clientId/follow-ups`
- `POST /api/v1/crm/clients/:clientId/follow-ups`

---

## 3) Prisma Schema Highlights

`backend/prisma/schema.prisma` includes:

- `User`, `Tenant`, `Membership` (multi-tenant core)
- `Profile` with `UserMode` (`PERSONAL` / `PROFESSIONAL`)
- `Task` with `TaskType` (`EXPENSE`, `REMINDER`, `APPOINTMENT`)
- `Client`, `FollowUp` for CRM
- `Conversation`, `Message` for assistant thread persistence
- enums for stages/status and `AgentType`

---

## 4) Local Run Instructions

From repository root:

```bash
cd lifeos
npm install
```

### Backend run

```bash
cd backend
cp .env.example .env
# set DATABASE_URL and JWT_SECRET
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Backend URL: `http://localhost:4000`

### Frontend run

```bash
cd ../frontend
cp .env.local.example .env.local
npm run dev
```

Frontend URL: `http://localhost:3001`

---

## 5) Example Requests

### Register user + tenant

```bash
curl -X POST http://localhost:4000/api/v1/auth/register   -H "Content-Type: application/json"   -d '{
    "email":"founder@lifeos.app",
    "password":"StrongPass123",
    "firstName":"Life",
    "lastName":"Owner",
    "tenantName":"LifeOS Studio",
    "professionalDescription":"Dentist clinic owner"
  }'
```

### Create expense task

```bash
curl -X POST http://localhost:4000/api/v1/tasks   -H "Authorization: Bearer <TOKEN>"   -H "x-tenant-id: <TENANT_ID>"   -H "Content-Type: application/json"   -d '{
    "type":"EXPENSE",
    "title":"Dental supplies",
    "amount":240.90,
    "dueDate":"2026-05-05T12:00:00.000Z"
  }'
```

### Chat with agent routing

```bash
curl -X POST http://localhost:4000/api/v1/assistant/chat   -H "Authorization: Bearer <TOKEN>"   -H "x-tenant-id: <TENANT_ID>"   -H "Content-Type: application/json"   -d '{
    "mode":"PROFESSIONAL",
    "message":"Create an Instagram caption to promote my dental cleaning package"
  }'
```

---

## 6) Future-Ready Integrations (planned stubs)

- WhatsApp API gateway (Evolution API or equivalent)
- OpenAI provider (plug into `assistant/agents.ts`)
- Open Finance connectors (transaction ingestion)
- Event bus + background workers for reminders/follow-up automations

---

## 7) Scaling Notes

- Keep modules independent (`/modules/*`) so each can become a bounded context.
- Promote each Agent into its own service layer when complexity grows.
- For SaaS scale, add:
  - RBAC per tenant
  - audit logs
  - webhook ingestion workers
  - idempotency keys for external integrations
