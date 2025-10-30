/**
 * Widget Preview Server
 * Simple Express server to preview widgets locally during development
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// Serve static files from project root
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot));

// Explicit route for preview.html
app.get('/widgets/preview.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'preview.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Widget Preview Server running!`);
  console.log(`   → Open: http://localhost:${PORT}/widgets/preview.html\n`);
  console.log(`   Press Ctrl+C to stop\n`);
});
