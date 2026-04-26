const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        wins: true,
        battles: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const submissionCount = await prisma.submission.count({
      where: { userId: req.user.id },
    });

    const winRate =
      user.battles > 0 ? Math.round((user.wins / user.battles) * 100) : 0;

    return res.json({
      stats: {
        id: user.id,
        username: user.username,
        email: user.email,
        wins: user.wins,
        battles: user.battles,
        submissions: submissionCount,
        winRate,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/recent
router.get('/recent', authenticate, async (req, res) => {
  try {
    const recentLobbyPlayers = await prisma.lobbyPlayer.findMany({
      where: { userId: req.user.id },
      orderBy: { joinedAt: 'desc' },
      take: 10,
      include: {
        lobby: {
          include: {
            host: { select: { id: true, username: true } },
            players: {
              include: {
                user: { select: { id: true, username: true } },
              },
            },
            submissions: {
              include: {
                user: { select: { id: true, username: true } },
                votes: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    const battles = recentLobbyPlayers.map((lp) => {
      const lobby = lp.lobby;

      const submission = lobby.submissions.find((s) => s.userId === req.user.id);

      const sortedSubmissions = [...lobby.submissions].sort(
        (a, b) => b.votes.length - a.votes.length
      );

      const winner = sortedSubmissions.length > 0 ? sortedSubmissions[0] : null;
      const isWinner = winner && winner.userId === req.user.id && winner.votes.length > 0;

      return {
        id: lobby.id,
        name: lobby.name,
        code: lobby.code,
        phase: lobby.phase,
        hostName: lobby.host.username,
        playerCount: lobby.players.length,
        joinedAt: lp.joinedAt,
        submitted: !!submission,
        submissionFileName: submission ? submission.fileName : null,
        voteCount: submission ? submission.votes.length : 0,
        isWinner: !!isWinner,
        winnerUsername: winner ? winner.user.username : null,
        createdAt: lobby.createdAt,
      };
    });

    return res.json({ battles });
  } catch (err) {
    console.error('Get recent battles error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
