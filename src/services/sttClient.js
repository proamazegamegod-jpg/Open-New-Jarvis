const WebSocket = require('ws');

const createSttClient = ({ url, onPartial }) => {
  let socket;
  let active = true;

  const connect = () => {
    socket = new WebSocket(url);

    socket.on('open', () => {
      console.log(`[stt] connected to ${url}`);
    });

    socket.on('message', (data) => {
      const text = data instanceof Buffer ? data.toString() : String(data);
      let payload = { text, isFinal: false };

      if (text.trim().startsWith('{')) {
        try {
          payload = JSON.parse(text);
        } catch (error) {
          console.warn('[stt] failed to parse message as JSON', error);
        }
      }

      // TODO: Replace with real STT protocol handling.
      if (onPartial) {
        onPartial(payload);
      }
    });

    socket.on('close', () => {
      if (!active) {
        return;
      }
      console.warn('[stt] connection closed, retrying in 1s');
      setTimeout(connect, 1000);
    });

    socket.on('error', (error) => {
      console.error('[stt] websocket error', error);
    });
  };

  connect();

  return {
    stop: () => {
      active = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    }
  };
};

module.exports = { createSttClient };
