# Adventure Cove – Confirmed Requirement Decisions

Stack: **Next.js** (App Router, TypeScript) + **Supabase** (operational data, auth, realtime) + **Hygraph** (website content, event/party descriptions & images).
Hygraph project id: `c90690b933c8446bbcee7253aa296d0f`
Currency: LKR. Language: English only. Branding: placeholder (theme tokens), real logo/colours later.
SMS / Email / Payment gateways: **not implemented now** – pluggable provider interfaces with a stub (log-only) provider.

---

## 1. Play-time pricing (all values editable in Admin → Settings)
- Hourly tiered rate: **1st hour = 1000**, **each additional hour = 800**.
- **15-minute buffer at every hour boundary**:

| Time played | Charge |
|---|---|
| 0 – 1h 15m | 1000 |
| 1h 16m – 2h 15m | 1800 |
| 2h 16m – 3h 15m | 2600 |
| … | +800 / hour |

- Minimum charge = first hour price (even 5 minutes → 1000).
- Billable hours formula: `hours = max(1, ceil((minutes - buffer) / 60))`; charge = first + (hours-1) × next.
- **Parents / guardians: free (FOC).**
- **Sibling discount**: X% off play time for 2nd child onwards (X in admin); play time only; only siblings checked in on the same visit.
- **No timer pause.** Timer runs check-in → checkout.

## 2. Child identity & registration
- Profile created by **staff at desk OR parent self-registration** (website).
- Required: parent name, mobile, **email, NIC**; child **name, DOB, gender**, **allergies / medical notes**.
- **Permanent QR**: printable card at desk **and** digital QR (portal / link).
- Scanner: **USB scanner (keyboard wedge) and device camera** both supported.

## 3. Check-in & live display
- Scan → profile opens (age, allergies, family, siblings) → staff confirms → timer starts. Siblings can be checked in in the same step.
- Play-area display: **child first name + elapsed timer + amber warning ~5 min before next hour is charged** (warning minutes configurable). No bill amounts shown.

## 4. POS & invoicing
- **VR**: fixed price per game/slot (admin).
- **Staff buddy**: hourly, assigned staff recorded; **same tiered + buffer rule as play** (own rates); **staff earns commission per buddy hour** → payroll.
- **Snacks & retail**: product catalog (name, category, price, SKU/barcode) **with stock**, auto-decrement, low-stock alerts. (No walk-in sales without a visit.)
- Add-ons can be added while children are playing.
- **One family invoice per visit**, itemised per child.
- Payments: cash (change calc), card, bank transfer / QR pay, **split payments**, loyalty points & pass hours as payment.
- Tax / service charge: **configurable in admin** (VAT, SSCL, service charge %), default off, separate invoice lines.

## 5. Loyalty, passes, memberships, offers
- Loyalty: **points per Rs. spent** (earn & redeem rates in admin) **+ visit stamps** (every Nth child-visit → reward, e.g. free hour).
- Points balance **per family**, **expiry after N months** (0 = never).
- **Multi-visit pass = hours bundle** (e.g. 10 h for Rs X, validity days). Shared by any child in family; deducts **billable hours** (after buffer rule); shortfall billed normally.
- **Memberships = paid tiers** (monthly/annual) with configurable benefits: % off play, % off café/retail, points multiplier, free hours / month.
- Offers: **happy hour** (days/time window), **promo codes / vouchers** (limits, expiry), **birthday offer** (DOB), **bundle / combo deals**.
- Stacking: **best single discount wins** (per line, system auto-picks).

## 6. Bookings
- **Play session booking**: reserve date/time + number of kids, **pay at venue**. **No capacity limit.**
- Online payment encouragement: confirmation page shows **bank account details + "Send payment slip via WhatsApp"** button; admin marks booking **Paid** → shows as prepaid at check-in.
- **Parties**: admin-defined **party packages** (duration, max kids, room, inclusions, price, extra-kid price); customer books package + date/time + room; advance via bank/WhatsApp.
- **Kids' events**: ticketed (title, date/time, price per child, max seats, image); online registration, seat count decreases.

## 7. Staff & payroll
- Attendance: **fingerprint machine** via (a) push API endpoint (ZKTeco ADMS-style / generic JSON) and (b) **CSV import**, plus **staff QR / PIN clock-in fallback**.
- Shift hours auto-calculated.
- Pay type per staff: **monthly salary OR hourly rate**; + overtime (OT rate), + buddy commission, − late/absent deductions. Monthly payroll summary.
- **EPF employee 8%, EPF employer 12%, ETF 3%** — configurable.
- Each visit auto-records handling cashier and buddy hours to staff records.
- Roles: **Owner / Manager / Cashier / Staff**.

## 8. Owner dashboard
- Real-time daily revenue, live floor count, remote pricing changes; mobile + desktop responsive.

## 9. Public website & parent portal
- Modern, mobile responsive; content from Hygraph.
- **Parent portal with mobile OTP login** (OTP shown in dev/stub until SMS gateway connected): children, QR cards, points, pass hours, bookings, invoices.

## 10. Notifications
- Engine with templates + queue/log: booking confirmation, check-in alert, checkout SMS (with invoice summary). Providers stubbed.

## Infra
- Supabase project **not created yet** → deliver SQL migrations in `supabase/migrations`; user creates project and applies them.
