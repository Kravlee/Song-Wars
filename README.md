# Song Wars

A real-time multiplayer music competition platform. Players join a lobby, download the same beat, create a song externally (FL Studio, etc.), upload their track before the timer ends, then vote on each other's work.

---

## Project Structure

```
Song Wars/
├── backend/       Express + Socket.IO + Prisma
└── frontend/      Next.js 14 + Tailwind CSS
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted — [Neon](https://neon.tech) free tier works great)
- [Supabase](https://supabase.com) project (free tier) for file storage

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@host:5432/songwars"
JWT_SECRET="change-this-to-a-random-secret"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-service-role-key"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

**Set up Supabase Storage:**
1. Go to your Supabase project → Storage
2. Create bucket named `beats` (set to **Public**)
3. Create bucket named `submissions` (set to **Public**)

**Set up the database:**
```bash
npm run db:generate
npm run db:push
```

**Start backend:**
```bash
npm run dev     # development (nodemon)
npm start       # production
```

Backend runs on `http://localhost:3001`

---

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

**Start frontend:**
```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

---

## Game Flow

| Phase | What Happens |
|-------|-------------|
| **Waiting** | Players join lobby, mark ready |
| **Battle** | Host uploads beat + sets timer. All players download beat, produce their track, upload before timer ends |
| **Preview** | Songs play one-by-one for everyone (60s each, auto-advances) |
| **Voting** | Each player votes for one song (can't vote own). 120s window |
| **Results** | Winner announced, podium shown, vote counts displayed |

---

## API Endpoints

```
POST /api/auth/register      Register new user
POST /api/auth/login         Login
GET  /api/auth/me            Current user

GET  /api/lobbies            List public lobbies (?phase=waiting)
POST /api/lobbies            Create lobby
GET  /api/lobbies/:id        Get lobby details
GET  /api/lobbies/code/:code Find lobby by code
POST /api/lobbies/:id/join   Join lobby
POST /api/lobbies/:id/leave  Leave lobby
POST /api/lobbies/:id/start  Start game (multipart: beat file + timerDuration)

POST /api/battles/:id/submit Upload submission (multipart: audio file)
POST /api/battles/:id/vote   Cast vote { submissionId }
GET  /api/battles/:id/results Get results

GET  /api/users/stats        My stats
GET  /api/users/recent       My recent battles
```

---

## Socket.IO Events

**Client → Server:**
```
join-lobby     { lobbyId }
leave-lobby    { lobbyId }
chat-message   { lobbyId, message }
player-ready   { lobbyId, isReady }
preview-next   { lobbyId }           (host only)
request-sync   { lobbyId }
```

**Server → Client:**
```
lobby-state          Full lobby state on join
player-joined        { player, players }
player-left          { userId, username }
host-changed         { newHostId }
lobby-updated        { players }
chat-message         { userId, username, message, timestamp }
phase-changed        { phase, ...phase-specific data }
submission-added     { submission }
vote-cast            { voterId, submissionId, totalVotes, playerCount }
lobby-closed         { reason }
error                { message }
```

---

## Deployment on Render

### Deploy Backend

1. Push the `backend/` folder to a GitHub repo (or a monorepo)
2. On Render → **New Web Service** → connect repo
3. Settings:
   - **Root directory:** `backend`
   - **Build command:** `npm install && npm run db:generate && npm run db:push`
   - **Start command:** `npm start`
4. Add environment variables (same as `.env`)
5. Set `FRONTEND_URL` to your frontend Render URL (e.g. `https://song-wars-ui.onrender.com`)

### Deploy Frontend

1. On Render → **New Static Site** or **Web Service**
2. Settings:
   - **Root directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Node version:** 18
3. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
   NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
   ```

### Database

Use [Neon](https://neon.tech) (free PostgreSQL):
1. Create project → get connection string
2. Set as `DATABASE_URL` in backend env vars

### Important: Render Free Tier

- Services spin down after 15 minutes of inactivity (cold start ~30s)
- Upgrade to a paid plan for always-on behavior
- Socket.IO requires a persistent connection — use a paid instance or Railway for production

---

## File Upload Limits

| File | Max Size | Formats |
|------|----------|---------|
| Beat (host) | 50 MB | MP3, WAV |
| Submission | 20 MB | MP3, WAV |

---

## Environment Variables Reference

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing (use a long random string) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (not anon key) |
| `PORT` | Server port (default: 3001) |
| `FRONTEND_URL` | Frontend origin for CORS |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_SOCKET_URL` | Backend socket URL |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT (bcryptjs + jsonwebtoken) |
| File Storage | Supabase Storage |
| Real-time | Socket.IO v4 |
