const express = require('express');
const yts = require('yt-search');

const router = express.Router();

// ─── Search YouTube for beats ─────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }

  try {
    const results = await yts(query);
    const videos = (results?.videos || []).slice(0, 10); // Return top 10

    if (!videos.length) {
      return res.status(404).json({ error: 'No videos found' });
    }

    const formatted = videos.map((video) => ({
      id: video.videoId,
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail || '',
      duration: video.duration || 'N/A',
    }));

    res.json({ videos: formatted });
  } catch (error) {
    console.error('Beat search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Get random beat suggestion ────────────────────────────────────────────────
router.get('/random', async (req, res) => {
  const artists = [
    'Drake type beat free for profit',
    'Kendrick Lamar type beat free for profit',
    'Travis Scott type beat free for profit',
    'J. Cole type beat free for profit',
    'Future type beat free for profit',
    'Lil Baby type beat free for profit',
    'Playboi Carti type beat free for profit',
    'Yeat type beat free for profit',
    'Lil Uzi Vert type beat free for profit',
    'Metro Boomin type beat free for profit',
  ];

  const artist = artists[Math.floor(Math.random() * artists.length)];
  const suffixes = ['', ' instrumental', ' beat instrumental', ' type beat'];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const query = artist + suffix;

  try {
    const results = await yts(query);
    const video = (results?.videos || []).find((v) => v.videoId);

    if (!video) {
      return res.status(404).json({ error: 'No video found' });
    }

    res.json({
      id: video.videoId,
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail || '',
      duration: video.duration || 'N/A',
    });
  } catch (error) {
    console.error('Random beat error:', error);
    res.status(500).json({ error: 'Failed to find beat' });
  }
});

module.exports = router;
