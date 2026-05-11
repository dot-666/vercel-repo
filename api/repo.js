const axios = require('axios');

module.exports = async function handler(req, res) {
  // 1. Validate method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Check access key
  const accessKey = req.headers['x-access-key'] || req.query.key;
  const expectedKey = process.env.ACCESS_KEY || 'supreme_2026';

  if (accessKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid or missing access key' });
  }

  // 3. Get GitHub config
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;
  const githubBranch = process.env.GITHUB_BRANCH || 'main';

  if (!githubToken || !githubRepo) {
    console.error('Missing GitHub configuration');
    return res.status(500).json({ error: 'Server misconfigured: missing GitHub credentials' });
  }

  try {
    const zipUrl = `https://api.github.com/repos/${githubRepo}/zipball/${githubBranch}`;
    const response = await axios({
      method: 'get',
      url: zipUrl,
      responseType: 'stream',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'vercel-repo'
      },
      timeout: 30000
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="repo.zip"');
    res.setHeader('Cache-Control', 'no-cache');

    response.data.pipe(res);
  } catch (error) {
    console.error('GitHub download error:', error.response?.status, error.response?.data?.message || error.message);
    res.status(502).json({ 
      error: 'Failed to fetch repository from GitHub',
      details: error.response?.data?.message || error.message
    });
  }
};
