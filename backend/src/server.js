require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const prisma = require('./lib/prisma');
const { initSocket, startBattleTimer, getIO } = require('./socket');

const authRoutes = require('./routes/auth');
const lobbyRoutes = require('./routes/lobbies');
const battleRoutes = require('./routes/battles');
const userRoutes = require('./routes/users');

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/users', userRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP Server + Socket.IO ──────────────────────────────────────────────────
const server = http.createServer(app);
initSocket(server);

// ─── Background: Recover Expired Battle Timers ────────────────────────────────
// This handles lobbies where timerEnd has passed but the server restarted
// before the in-memory timer could fire.
async function recoverExpiredBattles() {
  try {
    const expiredLobbies = await prisma.lobby.findMany({
      where: {
        phase: 'battle',
        timerEnd: { lt: new Date() },
      },
      select: { id: true, timerEnd: true },
    });

    for (const lobby of expiredLobbies) {
      console.log(`Recovering expired battle for lobby ${lobby.id}`);
      const ioInstance = getIO();
      if (ioInstance) {
        // timerEnd is already past, startBattleTimer will fire immediately
        startBattleTimer(ioInstance, lobby.id, lobby.timerEnd.getTime());
      }
    }
  } catch (err) {
    console.error('Error recovering expired battles:', err);
  }
}

// ─── Background Interval ──────────────────────────────────────────────────────
// Check every 30 seconds for lobbies that should have transitioned already.
async function checkAndTransitionLobbies() {
  try {
    const now = new Date();

    // Lobbies stuck in 'battle' phase past their timer
    const expiredBattleLobbies = await prisma.lobby.findMany({
      where: {
        phase: 'battle',
        timerEnd: { lt: now },
      },
      select: { id: true, timerEnd: true },
    });

    for (const lobby of expiredBattleLobbies) {
      const ioInstance = getIO();
      if (ioInstance) {
        console.log(`Auto-transitioning expired battle lobby: ${lobby.id}`);
        startBattleTimer(ioInstance, lobby.id, lobby.timerEnd.getTime());
      }
    }
  } catch (err) {
    console.error('Background check error:', err);
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`Song Wars backend running on port ${PORT}`);

  // Run initial recovery for any lobbies that expired while server was down
  await recoverExpiredBattles();

  // Set up background interval
  setInterval(checkAndTransitionLobbies, 30 * 1000);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
