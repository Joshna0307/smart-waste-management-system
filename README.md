# JOY University Smart Waste Management System

A campus-focused web app for recording waste, requesting collection, and following material through collection, storage, processing and transfer.

## Current features

- User registration and sign-in with an HTTP-only session cookie
- Admin and user views backed by Neon PostgreSQL
- Campus locations for blocks, hostels, canteen and SAC, plus a schematic 2D campus map
- Waste reports with category, quantity, notes and optional JPG/PNG/WEBP photo
- Browser camera object-detection suggestion (COCO-SSD); users must verify the category manually
- Collection requests linked to an existing waste record
- User-scoped request tracking and admin-only status updates
- Status history with actor, timestamp and optional admin note
- Collection stages: pending, assigned, in progress, collected, stored, processed and transferred

## Technology

- Frontend: HTML, CSS and vanilla JavaScript
- API: Vercel Node.js serverless functions
- Database: Neon PostgreSQL
- Authentication: bcrypt password hashes and signed JWT in an HTTP-only cookie

## Deployment configuration

Set these Vercel environment variables for Production (and Preview if needed):

- `DATABASE_URL`: Neon PostgreSQL connection string
- `JWT_SECRET`: long, random secret used to sign sessions

Do not commit real credentials or place them in frontend JavaScript.

## Database setup

For a new database, run `database/schema.sql` once in the Neon SQL Editor.

For an existing database created by an earlier version, run unapplied files in `database/migrations/` in numeric order. In particular, run:

1. `002_collection_request_history.sql` if collection request history has not yet been installed
2. `003_collection_request_workflow.sql` to add the waste-record link and the extended collection stages

Migration 003 is designed to be re-runnable and preserves existing requests. Older requests remain visible with no linked waste record; new requests must reference a pending waste record.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set a Neon `DATABASE_URL` and a strong `JWT_SECRET`.
4. Run `npx vercel dev` to start the local Vercel development server.
5. Run `npm run check` to syntax-check the API and browser JavaScript files.

## Collection workflow

1. A signed-in user records waste for a campus location.
2. The user selects that pending waste record in **Request waste collection**. Location, category and quantity are read from the record, not trusted from the browser.
3. The API verifies the session and record ownership, then creates the request and its first history event in one transaction.
4. Users can see only their own requests and waste records. Admins can review all requests and change statuses.
5. Admin status changes update the linked waste record and append an audit event. A rejected request returns the linked record to pending.

## Operational notes

- The map is schematic and not to scale; verify bin positions before operational use.
- Camera classification is a general object detector, not a dedicated waste-material classifier. Confirm every suggested category.
- Report images are stored in PostgreSQL; keep the 2 MB upload limit and monitor database storage.
- Use demonstration accounts and non-sensitive sample data until campus access rules and admin provisioning are finalized.
