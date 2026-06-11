// api/analyze.js — Vercel serverless function
// Set GEMINI_API_KEY and/or ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  const geminiKey    = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // ── Gemini first (free tier) ─────────────────────────────────────────────
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return res.status(200).json({ text });
    } catch (err) {
      console.error('Gemini error:', err.message);
      if (!anthropicKey) return res.status(500).json({ error: 'Gemini error: ' + err.message });
    }
  }

  // ── Fallback: Claude ──────────────────────────────────────────────────────
  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Anthropic API error' });
      return res.status(200).json({ text: data.content[0].text });
    } catch (err) {
      return res.status(500).json({ error: 'Claude error: ' + err.message });
    }
  }

  return res.status(500).json({
    error: 'No API key found. Add GEMINI_API_KEY or ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.'
  });
}
