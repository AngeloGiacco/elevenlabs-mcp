#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = resolve(__dirname, '../bin/mcp-server.js');

const args = [
  'npx',
  '@modelcontextprotocol/inspector',
  'node',
  serverPath
];

// Add version if specified (the only configurable option from command line)
if (process.env.SERVER_VERSION) {
  args.push(`--version=${process.env.SERVER_VERSION}`);
}

// Execute the command with environment variables
// This ensures ELEVENLABS_API_KEY is passed through
import { spawn } from 'child_process';
const inspect = spawn(args[0], args.slice(1), { 
  stdio: 'inherit',
  env: process.env 
});

inspect.on('error', (err) => {
  console.error('Failed to start inspector:', err);
  process.exit(1);
});

inspect.on('exit', (code) => {
  process.exit(code || 0);
});