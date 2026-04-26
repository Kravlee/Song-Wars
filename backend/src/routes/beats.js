const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ARTISTS_FILE = path.join(__dirname, '../../artists.txt');

let artistsList = [];

// Load artists from file on startup
function loadArtists() {
  try {
    const content = fs.readFileSync(ARTISTS_FILE, 'utf-8');
    artistsList = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    console.log(`Loaded ${artistsList.length} artists from artists.txt`);
  } catch (err) {
    console.error('Failed to load artists.txt:', err);
    artistsList = [
      'Drake type beat free for profit',
      'Kendrick Lamar type beat free for profit',
      'Travis Scott type beat free for profit',
    ];
  }
}

loadArtists();

// ─── Search YouTube for beats ─────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }

  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  try {
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(youtubeUrl);
    const data = await response.json();

    if (data.error) {
      console.error('YouTube API error:', data.error);
      return res.status(500).json({ error: 'YouTube search failed' });
    }

    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: 'No videos found' });
    }

    const videos = data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.default.url,
      duration: 'N/A', // YouTube search API doesn't return duration
    }));

    res.json({ videos });
  } catch (error) {
    console.error('Beat search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Get random beat suggestion ────────────────────────────────────────────────
router.get('/random', async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  if (artistsList.length === 0) {
    return res.status(500).json({ error: 'No artists loaded' });
  }

  const artist = artistsList[Math.floor(Math.random() * artistsList.length)];
  const suffixes = ['', ' instrumental', ' beat instrumental', ' type beat'];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const query = artist + suffix;

  try {
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(youtubeUrl);
    const data = await response.json();

    if (data.error || !data.items || data.items.length === 0) {
      console.error('YouTube API error:', data.error);
      return res.status(500).json({ error: 'Failed to find beat' });
    }

    const item = data.items[0];
    res.json({
      id: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.default.url,
      duration: 'N/A',
    });
  } catch (error) {
    console.error('Random beat error:', error);
    res.status(500).json({ error: 'Failed to find beat' });
  }
});

module.exports = router;
