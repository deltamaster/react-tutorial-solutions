// Script to wait for React dev server and then start Electron
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

const options = {
  resources: ['http://localhost:3000'],
  delay: 1000,
  interval: 100,
  timeout: 60000,
  window: 1000,
};

console.log('Waiting for React dev server at http://localhost:3000...');

waitOn(options)
  .then(() => {
    console.log('React dev server is ready! Starting Electron...');
    // Use the Electron binary from node_modules
    const electronPath = require('electron');
    // For development, use root electron.js directly
    const electron = spawn(electronPath, [path.join(__dirname, 'electron.js')], {
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'inherit',
      cwd: __dirname
    });

    electron.on('close', (code) => {
      process.exit(code);
    });

    electron.on('error', (err) => {
      console.error('Failed to start Electron:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Error waiting for React dev server:', err);
    process.exit(1);
  });
