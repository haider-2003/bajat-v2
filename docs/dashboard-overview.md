# Bajat Dashboard — Overview

## What is this?

**Bajat** ("Smart Identity System") is a multi-tenant admin dashboard for designing, issuing, and managing digital/physical ID cards for organizations — companies, ministries, universities, municipalities, and similar institutions.

An organization uses the dashboard to:

1. **Design ID card templates** — lay out the card's appearance and define its data fields.
2. **Register and manage members** — the people who will receive ID cards.
3. **Collect ID requests** — submitted either by staff directly in the dashboard, or by members themselves through a public self-service flow (the "SuperQi mini app").
4. **Review, approve, and route requests** — through an organizational hierarchy of branches/nodes.
5. **Process payment, printing, and delivery** of the finished card.

## Who uses it

- **Platform admins** — manage the overall system: organizations, admin users, admin roles.
- **Organization users** — staff within a tenant organization who manage that organization's members, templates, and ID requests, scoped by role-based permissions.
- **Branch users** — staff scoped to a specific branch/node within an organization's hierarchy.

Access to every section of the dashboard is gated by a permission system (see [Authentication & Permissions](./dashboard-features.md#authentication--permissions) in the features doc).

## Tech stack

- **Framework:** Next.js 15 (App Router) + React 19
- **UI:** Mantine v8, Tabler icons, Blueprint.js
- **Data:** TanStack React Query (server state), Zustand (client/auth state), Axios
- **Forms/validation:** Zod + Mantine form
- **i18n:** next-intl, English & Arabic (with RTL support)
- **Card design tooling:** Polotno canvas editor, Fabric.js, Konva, jsPDF, QR code generation, signature capture
- **Maps & charts:** Leaflet/Mapbox for member location maps, Recharts for analytics

## High-level structure

The dashboard is organized around a sidebar with the following top-level sections:

- Home (analytics overview)
- ID Issuance (Templates, Requests, ID Flow, Export History)
- App Users / Members
- Members Requests
- Payments
- Printer
- Delivery
- Nodes (organizational hierarchy)
- API Integration (API Keys, Webhooks)
- Black List
- Organization Management (Organizations, Organization Users, Organization Roles)
- Branch Management (Branches, Branch Users, Branch Roles)
- Management (platform Admins, Admin Roles) — admin-only

See [dashboard-features.md](./dashboard-features.md) for a detailed breakdown of each section.
