const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { uploadSubmission } = require('../lib/storage');

const router = express.Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter(req, file, cb) {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 and WAV audio files are allowed'));
    }
  },
});

// POST /api/battles/:id/submit
router.post('/:id/submit', authenticate, audioUpload.single('audio'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        players: true,
        submissions: true,
      },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.phase !== 'battle') {
      return res.status(400).json({ error: 'Submissions are only allowed during the battle phase' });
    }

    if (lobby.timerEnd && new Date() > lobby.timerEnd) {
      return res.status(400).json({ error: 'The submission window has closed' });
    }

    const isInLobby = lobby.players.some((p) => p.userId === req.user.id);
    if (!isInLobby) {
      return res.status(403).json({ error: 'You are not in this lobby' });
    }

    const existingSubmission = lobby.submissions.find((s) => s.userId === req.user.id);
    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already submitted for this battle' });
    }

    const fileUrl = await uploadSubmission(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const submission = await prisma.submission.create({
      data: {
        lobbyId: id,
        userId: req.user.id,
        fileUrl,
        fileName: req.file.originalname,
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(`lobby:${id}`).emit('submission-added', {
          submission: {
            id: submission.id,
            userId: submission.userId,
            username: submission.user.username,
            fileName: submission.fileName,
            createdAt: submission.createdAt,
          },
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error on submit:', socketErr);
    }

    return res.status(201).json({ submission });
  } catch (err) {
    if (err.message && err.message.includes('audio files are allowed')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/battles/:id/vote
router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        players: true,
        submissions: {
          include: { votes: true },
        },
        votes: true,
      },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.phase !== 'voting') {
      return res.status(400).json({ error: 'Voting is only allowed during the voting phase' });
    }

    const isInLobby = lobby.players.some((p) => p.userId === req.user.id);
    if (!isInLobby) {
      return res.status(403).json({ error: 'You are not in this lobby' });
    }

    const targetSubmission = lobby.submissions.find((s) => s.id === submissionId);
    if (!targetSubmission) {
      return res.status(404).json({ error: 'Submission not found in this lobby' });
    }

    if (targetSubmission.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot vote for your own submission' });
    }

    const existingVote = lobby.votes.find((v) => v.voterId === req.user.id);
    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted in this lobby' });
    }

    const vote = await prisma.vote.create({
      data: {
        submissionId,
        voterId: req.user.id,
        lobbyId: id,
      },
    });

    // Check if all players who submitted have now been voted on (all eligible voters voted)
    const updatedLobby = await prisma.lobby.findUnique({
      where: { id },
      include: {
        players: true,
        votes: true,
        submissions: true,
      },
    });

    // Eligible voters: players who have a submission (participants)
    // All players can vote except for themselves
    const totalVotes = updatedLobby.votes.length;
    const playerCount = updatedLobby.players.length;

    // If every player has voted, finalize
    if (totalVotes >= playerCount) {
      try {
        const { getIO, finalizeVoting } = require('../socket');
        const io = getIO();
        if (io) {
          finalizeVoting(io, id);
        }
      } catch (socketErr) {
        console.error('Socket finalize voting error:', socketErr);
      }
    } else {
      try {
        const { getIO } = require('../socket');
        const io = getIO();
        if (io) {
          io.to(`lobby:${id}`).emit('vote-cast', {
            voterId: req.user.id,
            submissionId,
            totalVotes,
            playerCount,
          });
        }
      } catch (socketErr) {
        console.error('Socket vote-cast emit error:', socketErr);
      }
    }

    return res.status(201).json({ vote });
  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/battles/:id/results
router.get('/:id/results', async (req, res) => {
  try {
    const { id } = req.params;

    const lobby = await prisma.lobby.findUnique({
      where: { id },
      select: { id: true, name: true, phase: true },
    });

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const submissions = await prisma.submission.findMany({
      where: { lobbyId: id },
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
    }

    return res.json({
      lobby,
      results,
      winner,
    });
  } catch (err) {
    console.error('Results error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
