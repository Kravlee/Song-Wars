const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { uploadBeat } = require('../lib/storage');

const router = express.Router();

const beatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for beats
  fileFilter(req, file, cb) {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 and WAV audio files are allowed'));
    }
  },
});

// GET /api/lobbies
router.get('/', async (req, res) => {
  try {
    const { phase } = req.query;

    const where = { isPublic: true };
    if (phase) {
      where.phase = phase;
    }

    const lobbies = await prisma.lobby.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        host: {
          select: { id: true, username: true },
        },
        players: {
          select: { id: true, userId: true, isReady: true },
        },
      },
    });

    const result = lobbies.map((lobby) => ({
      id: lobby.id,
      name: lobby.name,
      code: lobby.code,
      isPublic: lobby.isPublic,
      maxPlayers: lobby.maxPlayers,
      phase: lobby.phase,
      hostId: lobby.hostId,
      hostName: lobby.host.username,
      playerCount: lobby.players.length,
      timerEnd: lobby.timerEnd,
      createdAt: lobby.createdAt,
    }));

    return res.json({ lobbies: result });
  } catch (err) {
    console.error('List lobbies error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lobbies
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, isPublic, maxPlayers, timerDuration } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Lobby name is required' });
    }

    if (name.trim().length > 60) {
      return res.status(400).json({ error: 'Lobby name must be 60 characters or less' });
    }

    const parsedMaxPlayers = parseInt(maxPlayers, 10) || 8;
    const parsedTimerDuration = parseInt(timerDuration, 10) || 30;

    if (parsedMaxPlayers < 2 || parsedMaxPlayers > 20) {
      return res.status(400).json({ error: 'Max players must be between 2 and 20' });
    }

    if (parsedTimerDuration < 1 || parsedTimerDuration > 180) {
      return res.status(400).json({ error: 'Timer duration must be between 1 and 180 minutes' });
    }

    // Generate unique lobby code
    let code;
    let codeExists = true;
    while (codeExists) {
      code = nanoid(6).toUpperCase();
      const existing = await prisma.lobby.findUnique({ where: { code } });
      codeExists = !!existing;
    }

    const lobby = await prisma.lobby.create({
      data: {
        name: name.trim(),
        code,
        isPublic: isPublic !== false,
        maxPlayers: parsedMaxPlayers,
        timerDuration: parsedTimerDuration,
        hostId: req.user.id,
        players: {
          create: {
            userId: req.user.id,
            isReady: false,
          },
        },
      },
      include: {
        host: {
          select: { id: true, username: true },
        },
        players: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    return res.status(201).json({ lobby });
  } catch (err) {
    console.error('Create lobby error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lobbies/code/:code
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const lobby = await prisma.lobby.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, name: true, code: true, phase: true, isPublic: true },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    return res.json({ lobby });
  } catch (err) {
    console.error('Find lobby by code error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/lobbies/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true },
        },
        players: {
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        submissions: {
          include: {
            user: { select: { id: true, username: true } },
            votes: { select: { id: true, voterId: true } },
          },
        },
      },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    return res.json({ lobby });
  } catch (err) {
    console.error('Get lobby error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lobbies/:id/join
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        players: true,
      },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.phase !== 'waiting') {
      return res.status(400).json({ error: 'Cannot join a lobby that has already started' });
    }

    const alreadyIn = lobby.players.find((p) => p.userId === req.user.id);
    if (alreadyIn) {
      return res.status(400).json({ error: 'You are already in this lobby' });
    }

    if (lobby.players.length >= lobby.maxPlayers) {
      return res.status(400).json({ error: 'Lobby is full' });
    }

    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: id,
        userId: req.user.id,
        isReady: false,
      },
    });

    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, username: true } },
        players: {
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    // Emit socket event
    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(`lobby:${id}`).emit('player-joined', {
          player: {
            userId: req.user.id,
            username: req.user.username,
          },
          players: updatedLobby.players,
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error on join:', socketErr);
    }

    return res.json({ lobby: updatedLobby });
  } catch (err) {
    console.error('Join lobby error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lobbies/:id/leave
router.post('/:id/leave', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { players: true },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const playerRecord = lobby.players.find((p) => p.userId === req.user.id);
    if (!playerRecord) {
      return res.status(400).json({ error: 'You are not in this lobby' });
    }

    await prisma.lobbyPlayer.delete({
      where: { id: playerRecord.id },
    });

    const remainingPlayers = lobby.players.filter((p) => p.userId !== req.user.id);

    if (remainingPlayers.length === 0) {
      // Delete the lobby if it's empty
      await prisma.lobby.delete({ where: { id } });

      try {
        const { getIO } = require('../socket');
        const io = getIO();
        if (io) {
          io.to(`lobby:${id}`).emit('lobby-closed', { reason: 'All players left' });
        }
      } catch (socketErr) {
        console.error('Socket emit error on lobby close:', socketErr);
      }

      return res.json({ message: 'Left lobby and lobby was deleted (empty)' });
    }

    // If host left, assign a new host
    if (lobby.hostId === req.user.id) {
      const newHost = remainingPlayers[0];
      await prisma.lobby.update({
        where: { id },
        data: { hostId: newHost.userId },
      });

      try {
        const { getIO } = require('../socket');
        const io = getIO();
        if (io) {
          io.to(`lobby:${id}`).emit('host-changed', { newHostId: newHost.userId });
        }
      } catch (socketErr) {
        console.error('Socket emit error on host change:', socketErr);
      }
    }

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(`lobby:${id}`).emit('player-left', {
          userId: req.user.id,
          username: req.user.username,
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error on leave:', socketErr);
    }

    return res.json({ message: 'Left lobby successfully' });
  } catch (err) {
    console.error('Leave lobby error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/lobbies/:id/start
router.post('/:id/start', authenticate, beatUpload.single('beat'), async (req, res) => {
  try {
    const { id } = req.params;
    const { timerDuration, beatYoutubeUrl, beatTitle } = req.body;

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { players: true },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.hostId !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can start the battle' });
    }

    if (lobby.phase !== 'waiting') {
      return res.status(400).json({ error: 'Lobby has already started' });
    }

    if (lobby.players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start' });
    }

    let beatUrl = null;
    let beatName = null;

    if (req.file) {
      beatUrl = await uploadBeat(req.file.buffer, req.file.originalname, req.file.mimetype);
      beatName = req.file.originalname;
    } else if (beatYoutubeUrl) {
      beatUrl = beatYoutubeUrl;
      beatName = beatTitle || 'YouTube Beat';
    } else {
      return res.status(400).json({ error: 'Please provide a beat file or select a YouTube beat' });
    }

    const parsedTimerDuration = parseInt(timerDuration, 10) || lobby.timerDuration;
    const timerEnd = new Date(Date.now() + parsedTimerDuration * 60 * 1000);

    const updatedLobby = await prisma.lobby.update({
      where: { id },
      data: {
        phase: 'battle',
        beatUrl,
        beatName,
        timerEnd,
        timerDuration: parsedTimerDuration,
      },
    });

    // Increment battles for all players
    const playerUserIds = lobby.players.map((p) => p.userId);
    await prisma.user.updateMany({
      where: { id: { in: playerUserIds } },
      data: { battles: { increment: 1 } },
    });

    // Emit socket event and start timer
    try {
      const { getIO, startBattleTimer } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(`lobby:${id}`).emit('phase-changed', {
          phase: 'battle',
          beatUrl,
          beatName,
          timerEnd: timerEnd.toISOString(),
          timerDuration: parsedTimerDuration,
        });
        startBattleTimer(io, id, timerEnd.getTime());
      }
    } catch (socketErr) {
      console.error('Socket emit error on start:', socketErr);
    }

    return res.json({ lobby: updatedLobby });
  } catch (err) {
    console.error('Start lobby error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
