const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

let io = null;

// In-memory game state: lobbyId -> { phase, timerTimeout, previewTimeout, previewIndex }
const gameStates = new Map();

function getIO() {
  return io;
}

// ─── Timer & Phase Functions ────────────────────────────────────────────────

function startBattleTimer(ioInstance, lobbyId, timerEndMs) {
  // Clear any existing timer for this lobby
  if (gameStates.has(lobbyId)) {
    const state = gameStates.get(lobbyId);
    if (state.timerTimeout) clearTimeout(state.timerTimeout);
  }

  const delay = timerEndMs - Date.now();

  const state = gameStates.get(lobbyId) || {};
  state.phase = 'battle';

  if (delay <= 0) {
    // Already expired — transition immediately
    state.timerTimeout = null;
    gameStates.set(lobbyId, state);
    setImmediate(() => startPreviewPhase(ioInstance, lobbyId));
    return;
  }

  state.timerTimeout = setTimeout(async () => {
    try {
      await prisma.lobby.update({
        where: { id: lobbyId },
        data: { phase: 'preview' },
      });
      startPreviewPhase(ioInstance, lobbyId);
    } catch (err) {
      console.error(`Battle timer error for lobby ${lobbyId}:`, err);
    }
  }, delay);

  gameStates.set(lobbyId, state);
}

async function startPreviewPhase(ioInstance, lobbyId) {
  try {
    const submissions = await prisma.submission.findMany({
      where: { lobbyId },
      include: {
        user: { select: { id: true, username: true } },
        votes: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (submissions.length === 0) {
      // No submissions — go straight to voting (or results)
      await startVotingPhase(ioInstance, lobbyId);
      return;
    }

    await prisma.lobby.update({
      where: { id: lobbyId },
      data: { phase: 'preview', currentPreviewIndex: 0 },
    });

    const state = gameStates.get(lobbyId) || {};
    state.phase = 'preview';
    state.previewIndex = 0;
    gameStates.set(lobbyId, state);

    ioInstance.to(`lobby:${lobbyId}`).emit('phase-changed', {
      phase: 'preview',
      submission: formatSubmission(submissions[0]),
      index: 0,
      total: submissions.length,
    });

    scheduleNextPreview(ioInstance, lobbyId, submissions, 0);
  } catch (err) {
    console.error(`startPreviewPhase error for lobby ${lobbyId}:`, err);
  }
}

function scheduleNextPreview(ioInstance, lobbyId, submissions, currentIndex) {
  const state = gameStates.get(lobbyId) || {};

  if (state.previewTimeout) {
    clearTimeout(state.previewTimeout);
  }

  state.previewTimeout = setTimeout(() => {
    advancePreview(ioInstance, lobbyId, submissions, currentIndex);
  }, 60 * 1000); // 60 seconds per preview

  gameStates.set(lobbyId, state);
}

async function advancePreview(ioInstance, lobbyId, submissions, currentIndex) {
  try {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= submissions.length) {
      // All previews done — move to voting
      await startVotingPhase(ioInstance, lobbyId);
      return;
    }

    await prisma.lobby.update({
      where: { id: lobbyId },
      data: { currentPreviewIndex: nextIndex },
    });

    const state = gameStates.get(lobbyId) || {};
    state.previewIndex = nextIndex;
    gameStates.set(lobbyId, state);

    ioInstance.to(`lobby:${lobbyId}`).emit('phase-changed', {
      phase: 'preview',
      submission: formatSubmission(submissions[nextIndex]),
      index: nextIndex,
      total: submissions.length,
    });

    scheduleNextPreview(ioInstance, lobbyId, submissions, nextIndex);
  } catch (err) {
    console.error(`advancePreview error for lobby ${lobbyId}:`, err);
  }
}

async function startVotingPhase(ioInstance, lobbyId) {
  try {
    await prisma.lobby.update({
      where: { id: lobbyId },
      data: { phase: 'voting' },
    });

    const state = gameStates.get(lobbyId) || {};
    state.phase = 'voting';

    if (state.previewTimeout) {
      clearTimeout(state.previewTimeout);
      state.previewTimeout = null;
    }

    // Auto-finalize after 120 seconds
    state.votingTimeout = setTimeout(() => {
      finalizeVoting(ioInstance, lobbyId);
    }, 120 * 1000);

    gameStates.set(lobbyId, state);

    ioInstance.to(`lobby:${lobbyId}`).emit('phase-changed', {
      phase: 'voting',
    });
  } catch (err) {
    console.error(`startVotingPhase error for lobby ${lobbyId}:`, err);
  }
}

async function finalizeVoting(ioInstance, lobbyId) {
  try {
    // Clear voting timeout if called manually
    if (gameStates.has(lobbyId)) {
      const state = gameStates.get(lobbyId);
      if (state.votingTimeout) {
        clearTimeout(state.votingTimeout);
        state.votingTimeout = null;
      }
      state.phase = 'results';
      gameStates.set(lobbyId, state);
    }

    const submissions = await prisma.submission.findMany({
      where: { lobbyId },
      include: {
        user: { select: { id: true, username: true } },
        votes: { select: { id: true, voterId: true } },
      },
    });

    const results = submissions
      .map((sub) => ({
        id: sub.id,
        userId: sub.userId,
        username: sub.user.username,
        fileName: sub.fileName,
        fileUrl: sub.fileUrl,
        voteCount: sub.votes.length,
        createdAt: sub.createdAt,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    let winner = null;
    if (results.length > 0 && results[0].voteCount > 0) {
      winner = results[0];
      // Increment winner's wins
      await prisma.user.update({
        where: { id: winner.userId },
        data: { wins: { increment: 1 } },
      });
    }

    await prisma.lobby.update({
      where: { id: lobbyId },
      data: { phase: 'results' },
    });

    ioInstance.to(`lobby:${lobbyId}`).emit('phase-changed', {
      phase: 'results',
      results,
      winner,
    });
  } catch (err) {
    console.error(`finalizeVoting error for lobby ${lobbyId}:`, err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSubmission(sub) {
  return {
    id: sub.id,
    userId: sub.userId,
    username: sub.user ? sub.user.username : null,
    fileName: sub.fileName,
    fileUrl: sub.fileUrl,
    createdAt: sub.createdAt,
  };
}

function cleanupLobbyState(lobbyId) {
  if (gameStates.has(lobbyId)) {
    const state = gameStates.get(lobbyId);
    if (state.timerTimeout) clearTimeout(state.timerTimeout);
    if (state.previewTimeout) clearTimeout(state.previewTimeout);
    if (state.votingTimeout) clearTimeout(state.votingTimeout);
    gameStates.delete(lobbyId);
  }
}

// ─── Socket Initialization ───────────────────────────────────────────────────

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return next(new Error('Invalid or expired token'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, email: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} | User: ${socket.user.username}`);

    // ── join-lobby ──────────────────────────────────────────────────────────
    socket.on('join-lobby', async ({ lobbyId }) => {
      try {
        if (!lobbyId) return;

        socket.join(`lobby:${lobbyId}`);
        console.log(`User ${socket.user.username} socket joined lobby:${lobbyId}`);

        // Small delay to let REST API update DB first
        setTimeout(async () => {
          try {
            const lobby = await prisma.lobby.findUnique({
              where: { id: lobbyId },
              include: {
                host: { select: { id: true, username: true } },
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
              socket.emit('error', { message: 'Lobby not found' });
              return;
            }

            // Send state to all in room
            io.to(`lobby:${lobbyId}`).emit('lobby-state', { lobby });
          } catch (queryErr) {
            console.error(`join-lobby DB error for ${lobbyId}:`, queryErr);
            socket.emit('error', { message: 'Failed to load lobby' });
          }
        }, 150);
      } catch (err) {
        console.error('join-lobby error:', err);
        socket.emit('error', { message: 'Failed to join lobby' });
      }
    });

    // ── leave-lobby ─────────────────────────────────────────────────────────
    socket.on('leave-lobby', ({ lobbyId }) => {
      if (!lobbyId) return;

      socket.leave(`lobby:${lobbyId}`);

      socket.to(`lobby:${lobbyId}`).emit('player-left', {
        userId: socket.user.id,
        username: socket.user.username,
      });
    });

    // ── chat-message ─────────────────────────────────────────────────────────
    socket.on('chat-message', async ({ lobbyId, message }) => {
      try {
        if (!lobbyId || !message) return;

        const trimmed = message.trim();
        if (trimmed.length === 0 || trimmed.length > 500) return;

        const saved = await prisma.chatMessage.create({
          data: {
            lobbyId,
            userId: socket.user.id,
            message: trimmed,
          },
        });

        io.to(`lobby:${lobbyId}`).emit('chat-message', {
          id: saved.id,
          userId: socket.user.id,
          username: socket.user.username,
          message: trimmed,
          timestamp: saved.createdAt.toISOString(),
        });
      } catch (err) {
        console.error('chat-message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── player-ready ─────────────────────────────────────────────────────────
    socket.on('player-ready', async ({ lobbyId, isReady }) => {
      try {
        if (!lobbyId) return;

        await prisma.lobbyPlayer.updateMany({
          where: { lobbyId, userId: socket.user.id },
          data: { isReady: !!isReady },
        });

        const updatedPlayers = await prisma.lobbyPlayer.findMany({
          where: { lobbyId },
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { joinedAt: 'asc' },
        });

        io.to(`lobby:${lobbyId}`).emit('lobby-updated', {
          players: updatedPlayers,
        });
      } catch (err) {
        console.error('player-ready error:', err);
        socket.emit('error', { message: 'Failed to update ready state' });
      }
    });

    // ── request-sync ─────────────────────────────────────────────────────────
    socket.on('request-sync', async ({ lobbyId }) => {
      try {
        if (!lobbyId) return;

        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: {
            host: { select: { id: true, username: true } },
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
          socket.emit('error', { message: 'Lobby not found' });
          return;
        }

        socket.emit('lobby-state', { lobby });
      } catch (err) {
        console.error('request-sync error:', err);
        socket.emit('error', { message: 'Failed to sync lobby state' });
      }
    });

    // ── preview-next ─────────────────────────────────────────────────────────
    socket.on('preview-next', async ({ lobbyId }) => {
      try {
        if (!lobbyId) return;

        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          select: { hostId: true, phase: true, currentPreviewIndex: true },
        });

        if (!lobby) return;

        // Only host can advance preview
        if (lobby.hostId !== socket.user.id) {
          socket.emit('error', { message: 'Only the host can advance the preview' });
          return;
        }

        if (lobby.phase !== 'preview') {
          socket.emit('error', { message: 'Not in preview phase' });
          return;
        }

        const submissions = await prisma.submission.findMany({
          where: { lobbyId },
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: 'asc' },
        });

        const nextIndex = lobby.currentPreviewIndex + 1;

        if (nextIndex >= submissions.length) {
          // Move to voting
          await startVotingPhase(io, lobbyId);
        } else {
          // Clear the auto-advance timeout and manually advance
          const state = gameStates.get(lobbyId) || {};
          if (state.previewTimeout) {
            clearTimeout(state.previewTimeout);
            state.previewTimeout = null;
          }
          gameStates.set(lobbyId, state);

          await advancePreview(io, lobbyId, submissions, lobby.currentPreviewIndex);
        }
      } catch (err) {
        console.error('preview-next error:', err);
        socket.emit('error', { message: 'Failed to advance preview' });
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} | User: ${socket.user.username}`);
    });
  });

  return io;
}

module.exports = {
  initSocket,
  getIO,
  startBattleTimer,
  startPreviewPhase,
  advancePreview,
  startVotingPhase,
  finalizeVoting,
  cleanupLobbyState,
};
