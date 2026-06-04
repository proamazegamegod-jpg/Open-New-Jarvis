const fs = require('fs/promises');
const path = require('path');

const defaultSettings = Object.freeze({
  geminiApiKey: ''
});

let cachedSettings = null;

const getSettingsDirectory = () => {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch (_error) {
    // Ignore and fall back to a local directory for non-Electron contexts.
  }

  return path.join(process.cwd(), '.app-data');
};

const getSettingsFilePath = () => path.join(getSettingsDirectory(), 'app-settings.json');

const normalizeSettings = (value) => ({
  geminiApiKey: String(value?.geminiApiKey || '').trim()
});

const loadSettings = async () => {
  if (cachedSettings) {
    return { ...cachedSettings };
  }

  try {
    const raw = await fs.readFile(getSettingsFilePath(), 'utf8');
    cachedSettings = normalizeSettings(JSON.parse(raw));
  } catch (_error) {
    cachedSettings = { ...defaultSettings };
  }

  return { ...cachedSettings };
};

const persistSettings = async (settings) => {
  cachedSettings = normalizeSettings(settings);
  const filePath = getSettingsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(cachedSettings, null, 2), 'utf8');
  return { ...cachedSettings };
};

const getAppSettings = async () => loadSettings();

const setGeminiApiKey = async (value) => {
  const current = await loadSettings();
  return persistSettings({
    ...current,
    geminiApiKey: String(value || '').trim()
  });
};

const getGeminiApiKey = async () => {
  const settings = await loadSettings();
  return settings.geminiApiKey || String(process.env.GEMINI_API_KEY || '').trim();
};

module.exports = {
  getAppSettings,
  getGeminiApiKey,
  setGeminiApiKey
};
