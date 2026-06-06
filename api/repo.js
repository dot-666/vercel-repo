// api/repo.js
const axios = require('axios');
const crypto = require('crypto');

const ACCESS_KEY = process.env.ACCESS_KEY || 'j-41-183-184';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER || 'dot-666';
const REPO_NAME = process.env.REPO_NAME || 'June-X-Ultra';
const BRANCH = process.env.REPO_BRANCH || 'main';
const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') ?? [];

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!ACCESS_KEY || !GITHUB_TOKEN) {
    console.error('Missing required environment variables');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (ALLOWED_IPS.length > 0) {
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress;
    if (!ALLOWED_IPS.includes(clientIP)) return res.status(403).json({ error: 'Forbidden' });
  }

  const providedKey = req.headers['x-access-key'];
  if (!providedKey) return res.status(403).json({ error: 'Forbidden' });

  const keyA = Buffer.from(providedKey.padEnd(64));
  const keyB = Buffer.from(ACCESS_KEY.padEnd(64));
  if (keyA.length !== keyB.length || !crypto.timingSafeEqual(keyA, keyB)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!/^[a-zA-Z0-9._/-]{1,100}$/.test(BRANCH)) {
    return res.status(400).json({ error: 'Invalid branch name' });
  }

  try {
    const archiveUrl = `https://api.github.com/repos/${encodeURIComponent(REPO_OWNER)}/${encodeURIComponent(REPO_NAME)}/zipball/${BRANCH}`;

    const { data } = await axios.get(archiveUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Relay/1.0',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      maxContentLength: 50 * 1024 * 1024,
      timeout: 30000,
    });

    const buffer = Buffer.from(data);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${REPO_NAME}.zip"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);

  } catch (err) {
    console.error('Relay error:', err.message);
    const status = err.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Repository not found' });
    if (status === 401) return res.status(500).json({ error: 'GitHub auth failed' });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
