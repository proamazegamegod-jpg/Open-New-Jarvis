const path = require('path');
const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

const buildTarget = process.env.BUILD_TARGET === 'electron' ? 'electron' : 'web';

module.exports = defineConfig({
  root: path.resolve(__dirname, 'src', 'renderer'),
  base: buildTarget === 'electron' ? './' : '/',
  plugins: [react()],
  build: {
    outDir:
      buildTarget === 'electron'
        ? path.resolve(__dirname, 'dist', 'renderer')
        : path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
