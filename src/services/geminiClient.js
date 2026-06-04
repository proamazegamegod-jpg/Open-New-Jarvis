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
const WORKFLOW_SYSTEM_PROMPT = `
You generate workflow JSON for Open-New-Jarvis on Windows.
Return ONLY a valid JSON object. No markdown fences. No commentary.

Supported action types:
- open_app { "type": "open_app", "executablePath": "..." , "args": ["..."]? }
- run_command { "type": "run_command", "command": "..." }
- open_url { "type": "open_url", "url": "https://..." }
- wait { "type": "wait", "ms": 1000 }

Return this exact shape:
{
  "id": "kebab-case-id",
  "name": "Short workflow name",
  "trigger": "short phrase a user would type or say",
  "summary": "one sentence summary",
  "confirm": true,
  "actions": []
}

Rules:
- Use 1 to 6 actions.
- Prefer safe, reviewable actions.
- Only use open_url with absolute https/http URLs.
- Only use open_app when you know a real Windows executable path.
- If you don't know an app path, prefer run_command or open_url instead.
- Keep triggers short and natural.
- Use kebab-case ids.
- Never include unsupported action types or extra top-level keys.
`;
const WORKFLOW_MATCH_SYSTEM_PROMPT = `
You match a spoken Windows workflow request to an existing workflow.
Return ONLY a valid JSON object. No markdown fences. No commentary.

Return this exact shape:
{
  "workflowId": "existing-workflow-id" | null,
  "confidence": 0,
  "reason": "short reason"
}

Rules:
- Only choose a workflowId that exists in the provided workflow list.
- Match based on the spoken intent, not exact wording.
- Near matches are allowed when the request clearly refers to the same workflow.
- If the request is ambiguous, incomplete, or does not clearly map to one workflow, return workflowId as null.
- Confidence must be between 0 and 1.
- Keep reason short.
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

const stripCodeFences = (value) =>
  String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

const parseJsonText = (value) => JSON.parse(stripCodeFences(value));

const requestGemini = async ({ model = DEFAULT_MODEL, systemPrompt, contents, generationConfig }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Missing GEMINI_API_KEY in .env.' };
  }

  const endpoint = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  try {
    const payload = await requestJson(endpoint, {
      systemInstruction: {
        role: 'system',
        parts: [{ text: String(systemPrompt || '').trim() }]
      },
      contents,
      generationConfig
    });

    return {
      ok: true,
      data: payload
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

const chat = async (messages = [], options = {}) => {
  const model = options.model || DEFAULT_MODEL;
  const response = await requestGemini({
    model,
    systemPrompt: SYSTEM_PROMPT,
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: options.temperature ?? 0.3
    }
  });
  if (!response.ok) {
    return response;
  }

  const payload = response.data;
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
};

const synthesizeWorkflow = async (prompt, options = {}) => {
  const trimmedPrompt = String(prompt || '').trim();
  if (!trimmedPrompt) {
    return { ok: false, error: 'Workflow prompt is required.' };
  }

  const response = await requestGemini({
    model: options.model || DEFAULT_MODEL,
    systemPrompt: WORKFLOW_SYSTEM_PROMPT,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Create a workflow for this request: ${trimmedPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  });
  if (!response.ok) {
    return response;
  }

  try {
    return {
      ok: true,
      data: parseJsonText(extractText(response.data))
    };
  } catch (error) {
    return {
      ok: false,
      error: `Gemini returned invalid workflow JSON: ${error.message}`
    };
  }
};

const matchWorkflowIntent = async (utterance, workflows = [], options = {}) => {
  const trimmedUtterance = String(utterance || '').trim();
  if (!trimmedUtterance) {
    return { ok: false, error: 'Voice transcript is required.' };
  }

  if (!Array.isArray(workflows) || workflows.length === 0) {
    return {
      ok: true,
      data: {
        workflowId: null,
        confidence: 0,
        reason: 'No workflows available.'
      }
    };
  }

  const response = await requestGemini({
    model: options.model || DEFAULT_MODEL,
    systemPrompt: WORKFLOW_MATCH_SYSTEM_PROMPT,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Transcript: ${trimmedUtterance}`,
              `Available workflows: ${JSON.stringify(workflows)}`
            ].join('\n\n')
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });
  if (!response.ok) {
    return response;
  }

  try {
    const parsed = parseJsonText(extractText(response.data));
    return {
      ok: true,
      data: {
        workflowId: typeof parsed?.workflowId === 'string' ? parsed.workflowId : null,
        confidence:
          typeof parsed?.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0,
        reason: String(parsed?.reason || '').trim()
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: `Gemini returned invalid workflow match JSON: ${error.message}`
    };
  }
};

module.exports = { chat, matchWorkflowIntent, synthesizeWorkflow };
