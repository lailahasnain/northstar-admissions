# Northstar Admissions

A ranked worklist and lead management system for college admissions officers. Built for Risely's FDE take-home assignment.

**Live demo:** https://northstar-admissions-alpha.vercel.app

**Test credentials:**
- Officer: `alex@northstar.edu` / `password123`
- Admin: `p.patel@northstar.edu` / `password123`

---

## Running Locally

**Prerequisites:** Node 20+, a Neon (or any Postgres) database

```bash
git clone https://github.com/lailahasnain/northstar-admissions
cd northstar-admissions
npm install
```

Create a `.env` file:
```
DATABASE_URL="your-postgres-connection-string"
NEXTAUTH_SECRET="any-random-string"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

Run migrations and seed:
```bash
npx prisma migrate dev
npm run seed
```

Start the dev server:
```bash
npm run dev
```

---

## Stack

- **Next.js 14** (App Router) — full-stack framework
- **Prisma 5 + PostgreSQL (Neon)** — ORM and database
- **NextAuth v4** — authentication with credentials provider
- **Tailwind CSS** — styling
- **Anthropic Claude** — agentic features
- **Vercel** — deployment

---

## Schema Design

See `prisma/schema-diagram.md` for the full entity relationship diagram. A rendered version is available at `prisma/schema-diagram.png`.

Key decisions:

**`currentStage` is denormalized onto `Lead`** — derived from the latest `StageHistory` entry at load time. This avoids a subquery on every list render. Tradeoff: requires discipline to keep in sync on stage changes (we update it in the loader and would add an update on stage change mutations).

**`LeadRanking` is a materialized table** — scores are computed and stored, not calculated at query time. This means the worklist is a simple SELECT with no scoring logic at read time. Tradeoff: scores can go stale between re-ranks. Acceptable for a daily worklist — officers re-rank on demand or on a schedule.

**`AuditLog` is append-only** — every meaningful action (contacted, reassigned, reranked) writes a row. Never updated or deleted. This gives us a full history for compliance and debugging.

**`externalId` on every imported record** — preserves the original IDs from the CRM JSON so we can cross-reference and re-import idempotently.

---

## Ranking Logic

Leads are ranked per officer using a **stage-gated scoring model**:

```
final_score = stage_base_score + signal_score
```

### Stage Base Scores
| Stage | Base Score |
|-------|-----------|
| Admitted | 100 |
| Applied | 60 |
| Inquiry | 30 |
| Deposited | 0 (terminal) |
| Withdrawn | 0 (terminal) |

Admitted leads always rank above Applied by default. This reflects the business reality that yield (deposit conversion) is more urgent than application conversion.

### Signal Scores
| Signal | Points | Rationale |
|--------|--------|-----------|
| Unanswered inbound message | +40 | Student is waiting for a response — highest urgency |
| Overdue open task | +30 | Officer has a committed action item past due |
| Missing checklist item | +20 | Enrollment is blocked until resolved |
| Competing schools | +15 | Flight risk — student is comparison shopping |
| Gone cold (7+ days no contact) | +10–30 | Silence compounds over time, capped at 30pts |
| Recent website engagement | +10 | Student is actively researching — good time to reach out |

### Why This Model
The model is intentionally simple and defensible. Every signal maps to a concrete action an officer should take. The weights reflect urgency hierarchy: an unanswered message (student waiting) outweighs an overdue task (officer commitment) which outweighs a missing document (blocking but passive).

Deposited and Withdrawn leads are excluded from the worklist entirely — they are terminal states requiring no officer action.

---

## Agentic Features

### Explain This Lead
Surfaces a 3-4 sentence narrative summary of a lead's current situation, streamed in real time. Placed on the lead detail page because it's most useful in context — when an officer is about to act on a lead, not while scanning the list.

The prompt includes: stage history, open tasks, competing schools, missing documents, recent conversation snippets, and ranking signals. This gives the model enough context to surface non-obvious insights (e.g. a financial aid blocker buried in the notes).

### Outreach Drafter
Drafts a personalized email or SMS based on the lead's context. The officer selects the channel before drafting. Placed alongside the explain feature — both are pre-action tools.

The prompt includes: the officer's name, the lead's program interests, competing schools, missing documents, and recent conversation context. This produces drafts that reference real details rather than generic templates.

Both features stream responses for perceived performance — the officer sees text appearing immediately rather than waiting for the full response.

---

## Observability & Audit Log

Every meaningful state change writes to `AuditLog`:

| Action | When | Why |
|--------|------|-----|
| `contacted` | Officer marks a lead as contacted | Tracks daily activity per officer, removes lead from today's list |
| `reassigned` | Admin reassigns a lead | Compliance trail, captures from/to officer IDs |
| `reranked` | Rankings are recomputed | Tracks when rankings ran and how many leads were scored |
| `stage_changed` | Lead moves between stages | Full funnel visibility |

**Why these and not others?** These are the actions that change what an officer sees and does next. Page views and UI interactions are noise at this stage — the signal is in state changes. The admin dashboard surfaces contacted-today counts per officer directly from the audit log, making it the ground truth for daily activity tracking.

In production I would add: scheduled re-ranking (cron), email/SMS send events from the outreach drafter, and alerting on leads that haven't been contacted in N days.

---

## Workflows

- **Mark as contacted** — removes lead from today's worklist, logs to audit trail
- **Re-rank** — recomputes all scores on demand, available to all officers
- **Reassign lead** — admin only, updates assignee and ranking table

---

## Authentication & Roles

- **Counselor** — sees only their own ranked worklist and leads
- **Admin** — sees all officers' worklists with officer filter, full admin dashboard, can reassign leads

Implemented with NextAuth v4 credentials provider + bcrypt password hashing. JWT sessions. Inactive users (Jordan Smith) cannot log in.

---

## AI Tools Used

- **Claude (claude.ai)** — used throughout the build for code generation, debugging, and architecture decisions. Particularly useful for the Prisma schema design and the ranking engine logic.