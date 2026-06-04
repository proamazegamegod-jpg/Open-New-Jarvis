const apiKey = process.env.GEMINI_API_KEY;

const chat = async (messages = [], options = {}) => {
  const lastMessage = messages[messages.length - 1];
  const lastUserText = lastMessage && lastMessage.content ? String(lastMessage.content) : '';

  // TODO: Replace with real Gemini API call using apiKey.
  return {
    ok: true,
    data: {
      id: 'mock-gemini-response',
      model: 'gemini-mock',
      apiKeyPresent: Boolean(apiKey),
      content: `Mock Gemini response. Replace this with a real API call.\nEcho: ${lastUserText}`,
      usage: {
        promptTokens: 0,
        completionTokens: 0
      },
      options
    }
  };
};

module.exports = { chat };
