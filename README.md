# Campus Maintenance Copilot

An end-to-end **AI Field Inspection & Maintenance Operations** portfolio platform built with TypeScript, Expo React Native (Android-first), React + Vite, Express, MongoDB, and Google Gemini.

Campus staff capture maintenance issues offline with a photo and a **Hindi, English, or Hinglish** voice note. Gemini converts the voice note into an editable English report with a transcript and suggested category. Supervisors triage, prioritize, and assign technicians on the web dashboard. Technicians receive jobs on mobile, start work, and upload after-repair photo evidence for supervisor verification and closure.

---

## Architecture & Workspace Layout

```text
packages/shared   # Shared TypeScript DTOs, Zod schemas, statuses, categories, transition rules
apps/api          # Express REST API, Mongoose models, JWT/cookie auth, Gemini AI, local/S3 media storage
apps/web          # React + Vite Supervisor Operations Dashboard
apps/mobile       # React Native + Expo Router Android-first app with SQLite offline queue
```

---

## 1. Prerequisites

- **Node.js** `>= 20` (tested on Node `26.13.1`) and **npm** `>= 10`
- **MongoDB** (local `mongod` or MongoDB Atlas connection string; for quick local demos without installing MongoDB, `USE_IN_MEMORY_DB=true` is supported in `apps/api/.env`)
- **Expo Go** or Android Emulator (API 33+) / EAS CLI for Android APK builds
- **Google Gemini API Key** (optional for `AI_MODE=mock`, required for `AI_MODE=live`)

---

## 2. Environment Variables

Copy each example file before running locally:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

### `apps/api/.env`

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Express API port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/campus_maintenance` |
| `USE_IN_MEMORY_DB` | Ephemeral in-memory MongoDB for quick demos | `false` |
| `JWT_SECRET` | Signing secret for session JWTs | `replace-with-32-char-secret` |
| `COOKIE_NAME` | HttpOnly cookie name for web sessions | `cmc_session` |
| `CORS_ORIGIN` | Allowed web dashboard origins (comma-separated) | `http://localhost:5173` |
| `STORAGE_DRIVER` | `local` (dev) or `s3` (prod) | `local` |
| `UPLOAD_DIR` | Local private media root when `STORAGE_DRIVER=local` | `./uploads` |
| `MEDIA_SIGNING_SECRET` | Secret for short-lived signed media URLs | `replace-with-media-secret` |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_FORCE_PATH_STYLE` | S3-compatible object storage credentials | — |
| `AI_MODE` | `live` (calls Gemini) or `mock` (labeled deterministic mock) | `live` |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key | `your-gemini-api-key` |
| `GEMINI_MODEL` | Gemini model ID | `gemini-3.1-flash-lite` |
| `AI_TIMEOUT_MS` | Gemini request timeout in ms | `25000` |
| `AI_RATE_LIMIT_MAX` | Per-user AI draft requests per 15 min | `20` |
| `LOGIN_RATE_LIMIT_MAX` | Per-IP login attempts per 15 min | `25` |

### `apps/web/.env`

- `VITE_API_BASE_URL`: Leave empty in local development to use Vite's `/api` proxy (`http://localhost:4000`). Set to your deployed HTTPS API origin in production (e.g., `https://api.campus-copilot.example.com`).

### `apps/mobile/.env`

- `EXPO_PUBLIC_API_URL`: Defaults to `http://10.0.2.2:4000` for Android Emulator.

---

## 3. Local Setup, Seeding, and Scripts

Install dependencies and build `@campus/shared`:

```bash
npm install
npm run build
```

Seed the fictional campus (`Academic Block`, `Labs`, `Hostel`, rooms, 4 users, and 6 sample tickets across statuses):

```bash
npm run seed
```

Start the API and web dashboard together:

```bash
npm run dev
```

Start the Expo mobile app in a separate terminal:

```bash
npm run dev:mobile
```

### Root Commands

- `npm run dev` — Run Express API (`:4000`) and React Supervisor Dashboard (`:5173`)
- `npm run dev:api` / `npm run dev:web` / `npm run dev:mobile` — Run each app individually
- `npm run build` — Build `packages/shared`, `apps/api`, and `apps/web`
- `npm run typecheck` — Typecheck all 4 workspaces
- `npm run lint` — Run ESLint across `packages` and `apps`
- `npm run test` — Run Vitest suites across `shared`, `api`, `web`, and `mobile`
- `npm run seed` — Seed MongoDB with campus locations, users, and sample tickets

---

## 4. Seeded Demo Credentials

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| **Reporter** | Asha Verma | `reporter@campus.edu` | `Password123!` |
| **Supervisor** | Vikram Nair | `supervisor@campus.edu` | `Password123!` |
| **Technician 1** | Rohan Das | `tech1@campus.edu` | `Password123!` |
| **Technician 2** | Meera Kulkarni | `tech2@campus.edu` | `Password123!` |

---

## 5. Running with Gemini (`live`) vs Labeled Mock AI (`mock`)

### Live Gemini Mode
In `apps/api/.env`:
```env
AI_MODE=live
GEMINI_API_KEY=your-real-gemini-api-key
GEMINI_MODEL=gemini-3.1-flash-lite
```
If the key is missing, quota is exhausted (`429`), or the request times out, the API returns a clear error without silently substituting mock data, and the mobile app keeps manual editing and submission available.

### Labeled Mock AI Mode (Dev / Demo without API Key)
In `apps/api/.env`:
```env
AI_MODE=mock
```
All generated drafts include `isMock: true` and `model: "mock-ai-v1"`, and the mobile Review Draft screen and web Ticket Detail view clearly display a **Mock AI Output** badge.

---

## 6. Connecting a Physical Android Device to the Local API

1. Connect your laptop/PC and Android phone to the **same Wi-Fi network**.
2. Find your computer's LAN IPv4 address (e.g., `ipconfig` on Windows -> `192.168.1.25`).
3. Ensure Windows Firewall allows inbound TCP on port `4000` (and Metro port `8081`).
4. Set `EXPO_PUBLIC_API_URL=http://192.168.1.25:4000` in `apps/mobile/.env` **or** tap **Configure API Server URL** directly on the mobile Sign In screen and enter `http://192.168.1.25:4000`.
5. Run `npm run dev:mobile` and scan the QR code in Expo Go (or run `npx expo run:android`).

---

## 7. Reproducible Portfolio Demo Script

1. **Offline Field Capture**: Sign in on mobile as `reporter@campus.edu`. Select **Academic Block → Room 204**. Enable Airplane Mode on the device/emulator, capture a photo, and record: *"Room 204 mein AC se paani tapak raha hai."*
2. **Persistence Across Restart**: Tap **Save Draft & Queue AI**, force-close the mobile app, and reopen it while still offline. Verify the draft, photo, and voice note are intact in **Drafts & Queue**.
3. **Reconnect & AI Review**: Disable Airplane Mode. The sync engine automatically processes the queued AI request and notifies that the draft is ready. Open **Review Draft**, verify the English title/description, original Hinglish transcript, and `HVAC` category, adjust if desired, and tap **Submit Ticket**.
4. **Supervisor Triage**: Sign in on the web dashboard (`http://localhost:5173`) as `supervisor@campus.edu`. Open the new ticket from **Overview** or **Work Queue**, set Priority to `High`, and assign **Rohan Das** (`tech1@campus.edu`).
5. **Technician Repair**: Sign in on mobile as `tech1@campus.edu`. Open the assigned job, tap **Start Work** (`Assigned` → `In Progress`), then tap **Submit Repair Photo & Note**, capture an after-repair photo, enter a completion note, and submit (`Awaiting Verification`).
6. **Supervisor Verification & Closure**: Open **Verification Queue** on the web dashboard, inspect the **Before** and **After** photos side-by-side, and click **Verify & Close** (`Closed`).
7. **Reporter Confirmation**: Sign back into mobile as `reporter@campus.edu` and open the ticket in **My Reports** to verify the `Closed` status, after-repair photo, completion note, and complete status timeline.

---

## 8. Deployment Guide

### A. MongoDB
Provision a managed MongoDB cluster (e.g., **MongoDB Atlas**) and configure network allowlists and a dedicated database user. Set `MONGODB_URI` to the `mongodb+srv://...` connection string.

### B. Persistent Private Media Storage (S3-Compatible)
Create a private bucket in **AWS S3**, **Cloudflare R2**, or **MinIO**. Keep public bucket access disabled. Set in the API environment:
```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # omit for AWS S3
S3_BUCKET=campus-maintenance-media
S3_REGION=auto
S3_ACCESS_KEY_ID=<your-access-key>
S3_SECRET_ACCESS_KEY=<your-secret-key>
S3_FORCE_PATH_STYLE=false
```
The API authorizes every attachment request and either streams the object or issues a short-lived signed URL.

### C. Express API (`apps/api`)
Deploy on **Render**, **Railway**, **Fly.io**, or a containerized Node 20+ host:
- Build command: `npm install && npm --workspace=@campus/shared run build && npm --workspace=@campus/api run build`
- Start command: `npm --workspace=@campus/api run start`
- Set `NODE_ENV=production`, a strong `JWT_SECRET`, `MEDIA_SIGNING_SECRET`, `CORS_ORIGIN=https://your-dashboard-domain.com`, and `GEMINI_API_KEY`.
- Run `npm run seed` once against the production database if deploying a demo environment.

### D. React Supervisor Dashboard (`apps/web`)
Deploy on **Vercel**, **Netlify**, or **Cloudflare Pages**:
- Build command: `npm install && npm --workspace=@campus/shared run build && npm --workspace=@campus/web run build`
- Output directory: `apps/web/dist`
- Set `VITE_API_BASE_URL=https://your-api-domain.com`
- Note: For cross-site `HttpOnly` cookies in production when dashboard and API are on different domains, configure them under subdomains of the same site (e.g., `app.example.com` and `api.example.com`) or proxy `/api/*` to the API origin.

### E. Mobile App (`apps/mobile`) & Android APK Build
1. Configure `apps/mobile/.env` (or EAS environment variables) with your deployed HTTPS API:
   ```env
   EXPO_PUBLIC_API_URL=https://api.campus-copilot.example.com
   ```
2. Install EAS CLI and log in to your Expo account:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. Build an installable Android APK (preview/internal distribution profile):
   ```bash
   cd apps/mobile
   eas build -p android --profile preview
   ```
   *(You can initialize `eas.json` with `eas build:configure` and set `"android": { "buildType": "apk" }` under `build.preview`.)*
# campus-maintenance-media
