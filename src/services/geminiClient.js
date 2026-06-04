const https = require('https');
const { URL } = require('url');

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const SYSTEM_PROMPT = `
You are Open-New-Jarvis.
Keep replies short, cut to the point, and properly formatted.
- Prefer 2-4 short sentences max.
- Use numbered steps only when describing the workflow.
- Avoid filler and repetition.
`;

const requestJson = (url, body) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const target = new URL(url);

    const request = https.request(
      {
        method: 'POST',
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Gemini error: ${response.statusCode} ${raw}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error(`Gemini JSON parse error: ${error.message}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(payload);
    request.end();
  });

const toGeminiContents = (messages = []) =>
  messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(message.content ?? '') }]
  }));

const extractText = (payload) =>
  payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

const chat = async (messages = [], options = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Missing GEMINI_API_KEY in .env.' };
  }

  const model = options.model || DEFAULT_MODEL;
  const endpoint = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  try {
    const payload = await requestJson(endpoint, {
      systemInstruction: {
        role: 'system',
        parts: [{ text: SYSTEM_PROMPT.trim() }]
      },
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: options.temperature ?? 0.3
      }
    });

    const content = extractText(payload);
    return {
      ok: true,
      data: {
        id: payload?.candidates?.[0]?.id || 'gemini-response',
        model,
        apiKeyPresent: true,
        content,
        usage: payload?.usageMetadata || { promptTokens: 0, completionTokens: 0 }
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

module.exports = { chat };
