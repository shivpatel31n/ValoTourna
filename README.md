# ValoTourna

A full-stack community platform for Valorant players — tournaments, teams, scrims, player profiles with live rank/match data, and Discord-integrated notifications, built on the MERN stack.

## Features

- **Authentication** — email/password (JWT + bcrypt) and "Sign in with Google", email verification, password reset via SMTP
- **Tournaments** — creation, browsing, countdown timers, join/registration flow, brackets
- **Teams** — team creation, detail pages, join requests
- **Scrims** — post and browse scrim requests, scrim detail pages
- **Player Profiles** — public profiles with HenrikDev API integration for live Valorant match history and rank
- **Nightly Rank Refresh** — scheduled cron job (`node-cron`) that keeps player ranks up to date
- **Notifications** — in-app notification bell + Discord webhook alerts (tournaments, scrims, team requests)
- **Admin Panel** — manage users and tournaments
- **Live Stats** — stats dashboard pulled from match/registration data

## Tech Stack

**Frontend** — React 19 + Vite, React Router 7
**Backend** — Node.js, Express, MongoDB (Mongoose), JWT auth, Nodemailer, node-cron
**Integrations** — HenrikDev API (Valorant data), Discord Webhooks, Google OAuth

## Project Structure

```
ValoTourna/
├── my-app/                    # React frontend (Vite)
│   └── src/
│       ├── ClutchCircuit.jsx      # Landing page
│       ├── AuthPage.jsx           # Login / signup
│       ├── TournamentsPage.jsx    # Tournament list
│       ├── TournamentDetailPage.jsx
│       ├── TeamsPage.jsx / TeamDetailPage.jsx / TeamCreatePage.jsx
│       ├── ScrimsPage.jsx / ScrimDetailPage.jsx / ScrimPostPage.jsx
│       ├── PlayersPage.jsx / PlayerProfilePage.jsx / ProfilePage.jsx
│       ├── AdminUsersPage.jsx / AdminTournamentsPage.jsx
│       ├── NotificationBell.jsx
│       └── components/            # Bracket, Reveal, shared UI
│
└── auth-backend/              # Express API
    ├── routes/                    # auth, players, tournaments, teams, scrims, notifications, stats, admin
    ├── models/                    # User, Tournament, Team, Match, Registration, ScrimRequest, Notification, RankHistory
    ├── services/                  # riotRank, rankRefreshJob, discordWebhook, mailer, notify, googleAuth
    ├── middleware/                 # authMiddleware (JWT)
    └── config/                     # db.js (MongoDB connection)
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A MongoDB database (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A [HenrikDev API key](https://docs.henrikdev.xyz/) for Valorant rank/match data
- (Optional) Discord webhook URLs for notifications, Google OAuth client ID, and SMTP credentials for email

### 1. Clone and install

```bash
git clone https://github.com/shivpatel31n/ValoTourna.git
cd ValoTourna

# Backend
cd auth-backend
npm install

# Frontend
cd ../my-app
npm install
```

### 2. Configure environment variables

**`auth-backend/.env`** (copy from `.env.example`):

```env
PORT=5000
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=7d
MONGODB_URI=your_mongodb_connection_string
CLIENT_ORIGIN=http://localhost:5173

HENRIKDEV_API_KEY=your_key_here

DISCORD_WEBHOOK_URL=
DISCORD_TEAM_WEBHOOK_URL=
DISCORD_GUILD_ID=

GOOGLE_CLIENT_ID=

FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="ValoTourna <your-address@gmail.com>"

# Optional rank-refresh job tuning — safe to leave blank
RANK_REFRESH_CRON=
RANK_REFRESH_TIMEZONE=
RANK_REFRESH_DELAY_MS=
```

**`my-app/.env`**:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### 3. Run it

```bash
# Terminal 1 — backend (from auth-backend/)
npm run dev

# Terminal 2 — frontend (from my-app/)
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend API on `http://localhost:5000`.

## API Overview

All routes are mounted under `/api`:

| Route | Description |
|---|---|
| `/api/auth` | Register, login, Google sign-in, email verification, password reset, `/me` |
| `/api/players` | Player discovery, filtering by rank/role |
| `/api/tournaments` | Tournament CRUD, registration/join flow |
| `/api/teams` | Team CRUD, join requests |
| `/api/scrims` | Scrim posting and browsing |
| `/api/notifications` | In-app notifications |
| `/api/stats` | Platform/player stats |
| `/api/admin` | Admin-only user and tournament management |

## Notes

- Nightly rank refresh runs via `services/rankRefreshJob.js` and respects HenrikDev API rate limits — tune `RANK_REFRESH_DELAY_MS` based on your API key tier (Basic: ~4500ms, Advanced: ~1350ms).
- If working with a teammate, use a shared MongoDB Atlas cluster rather than separate local instances to keep data in sync.
- On Windows, if you hit git object errors, run `git config --global gc.auto 0` and add a Windows Defender exclusion for the repo folder.

## Roadmap

- [ ] Match brackets polish
- [ ] Check-in flow refinement
- [ ] Additional admin controls
- [ ] UI/UX polish pass

## License

Not yet specified.