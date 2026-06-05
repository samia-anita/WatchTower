const express = require('express');
const router  = express.Router();
const https   = require('https');

const PRIVATE = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fd/,
];

function isPrivate(ip) {
  return !ip || ip === 'unknown' || PRIVATE.some(r => r.test(ip));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });
}

// Simple in-process cache
const cache = new Map();

router.get('/:ip', async (req, res) => {
  const { ip } = req.params;

  if (isPrivate(ip)) return res.json({ private: true, ip });

  if (cache.has(ip)) return res.json(cache.get(ip));

  try {
    const data = await fetchJson(`https://ipwho.is/${ip}`);
    if (!data.success) {
      cache.set(ip, null);
      return res.json({ found: false, ip });
    }
    const result = {
      found:       true,
      ip,
      country:     data.country     || null,
      countryCode: data.country_code || null,
      city:        data.city         || null,
      region:      data.region       || null,
      flag:        data.flag?.emoji  || null,
      isp:         data.connection?.isp || null,
    };
    cache.set(ip, result);
    return res.json(result);
  } catch {
    return res.json({ found: false, ip });
  }
});

module.exports = router;
