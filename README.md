# Adventure Cove – Integrated Management System

Next.js 15 + Supabase (+ Hygraph from Phase 3). Business rules: `docs/REQUIREMENTS-DECISIONS.md`.

## Phase 1 – what's included
- Staff login, roles (Owner / Manager / Cashier / Staff), first-time owner setup (`/setup`)
- Family & child registration – at the desk (`/desk/register`) or by parents online (`/register`)
- Permanent child QR – printable card (`/cards/<childId>`) + digital card (`/my-card/<token>`)
- Front desk (`/desk`): USB scanner or camera scan → profile with allergy warnings → check-in siblings together → timers start
- Visit screen: live timers, running family bill, VR / snacks / retail, staff buddy (hourly + commission), split payments, one invoice
- Pricing engine: tiered hourly (first hour / next hour) with per-hour buffer, sibling %, configurable taxes
- Play-area TV (`/display?token=…`): first name, timer, amber warning before next hour
- Admin: settings & pricing (Owner), products/VR/stock with low-stock alerts, staff accounts

## Setup
1. Create a Supabase project.
2. Supabase → SQL Editor → run `supabase/migrations/0001_core.sql`.
3. Copy `.env.example` → `.env.local` and fill in the URL, anon key and service-role key.
4. `npm install` then `npm run dev` → open http://localhost:3000/setup to create the Owner.
5. Admin → Settings: set a display token, then open `/display?token=<token>` on the play-area TV.
6. Admin → Products: add VR games, snacks and retail items.

## Tests
`npm test` – pricing engine unit tests (Node built-in test runner).

## Notes
- All writes go through server actions using the service-role key **after** a role check; RLS gives staff read-only access (used for realtime).
- Checkout, stock decrement and item removal run in Postgres functions (single transaction).
- SMS / email / payment gateways are not connected yet.
