const WebSocket = require('ws');

const createSttClient = ({ url, onPartial, onFinal, onStatus }) => {
  let socket;
  let active = true;

  const connect = () => {
    socket = new WebSocket(url);

    socket.on('open', () => {
      console.log(`[stt] connected to ${url}`);
      if (onStatus) {
        onStatus({ type: 'status', state: 'connected' });
      }
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

      if (payload.type === 'status' && onStatus) {
        onStatus(payload);
        return;
      }

      if (payload.type === 'final' && onFinal) {
        onFinal(payload);
        return;
      }

      if (onPartial) {
        onPartial(payload);
      }
    });

    socket.on('close', () => {
      if (!active) {
        return;
      }
      console.warn('[stt] connection closed, retrying in 1s');
      if (onStatus) {
        onStatus({ type: 'status', state: 'disconnected' });
      }
      setTimeout(connect, 1000);
    });

    socket.on('error', (error) => {
      console.error('[stt] websocket error', error);
      if (active && onStatus) {
        onStatus({ type: 'status', state: 'disconnected', error: error.message });
      }
    });
  };

  connect();

  return {
    stop: () => {
      active = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
        return;
      }
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        try {
          socket.once('error', () => {});
          socket.terminate();
        } catch (_error) {
          // Ignore shutdown races while a connection is still opening.
        }
      }
    }
  };
};

module.exports = { createSttClient };
