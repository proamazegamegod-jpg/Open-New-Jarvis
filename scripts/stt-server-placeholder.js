const WebSocket = require('ws');

const port = 9000;
const wss = new WebSocket.Server({ port });

console.log(`[stt-placeholder] listening on ws://localhost:${port}`);

const samples = [
  'hello mini-jarvis',
  'open the command editor',
  'validate the deployment command',
  'dry run the cleanup task',
  'run the demo workflow'
];

wss.on('connection', (socket) => {
  console.log('[stt-placeholder] client connected');
  let index = 0;

  const interval = setInterval(() => {
    const payload = {
      text: samples[index % samples.length],
      isFinal: false,
      timestamp: Date.now()
    };

    // TODO: Replace with faster-whisper streaming output.
    socket.send(JSON.stringify(payload));
    index += 1;
  }, 1500);

  socket.on('close', () => {
    clearInterval(interval);
    console.log('[stt-placeholder] client disconnected');
  });
});

process.on('SIGINT', () => {
  wss.close(() => {
    process.exit(0);
  });
});
