#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = process.env.PORT || 3000;

// MIME type map
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.vm': 'text/plain; charset=utf-8',
  '.jack': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function resolvePath(reqPath) {
  // Parse URL safely
  let pathname;
  try {
    // Extract pathname only (ignore query string)
    const urlObj = new URL(reqPath, 'http://localhost');
    pathname = urlObj.pathname;
  } catch (e) {
    // Fallback: treat as raw path
    pathname = String(reqPath);
  }
  
  // Remove leading slash
  let relPath = pathname.replace(/^\/+/, '');
  
  // Decode URI (but validate against traversal)
  try {
    relPath = decodeURIComponent(relPath);
  } catch (e) {
    // Malformed URI
    return null;
  }
  
  // Prevent directory traversal: disallow .. and absolute paths
  if (relPath.includes('..') || relPath.startsWith('/')) {
    return null;
  }
  
  // Resolve path within dist/
  const baseDir = path.resolve(rootDir, 'dist');
  const resolved = path.resolve(baseDir, relPath);
  
  // Verify resolved path is within baseDir
  if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
    return null;
  }
  
  return resolved;
}

const server = http.createServer((req, res) => {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }
  
  const filePath = resolvePath(req.url);
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  
  // Try file, then directory/index.html
  let targetPath = filePath;
  let isIndexRequest = false;
  
  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      // Directory: try index.html
      targetPath = path.join(targetPath, 'index.html');
      isIndexRequest = true;
    }
  } catch (e) {
    // Path doesn't exist yet; will be caught by stat() below
  }
  
  fs.stat(targetPath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    
    // Ensure it's a file, not directory
    if (!stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    
    const mimeType = getMimeType(targetPath);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });
    
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    
    const stream = fs.createReadStream(targetPath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`\n✓ Server running at http://127.0.0.1:${port}`);
  console.log(`  Serving from: ${path.relative(process.cwd(), path.join(rootDir, 'dist'))}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Server stopped');
  process.exit(0);
});
