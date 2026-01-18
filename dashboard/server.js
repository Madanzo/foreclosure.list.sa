// Simple Node.js server for the dashboard
// Serves static files and provides an API for status persistence

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const DASHBOARD_DIR = __dirname;
const STATUS_FILE = path.join(DASHBOARD_DIR, 'data', 'status.json');

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Ensure status.json exists
if (!fs.existsSync(STATUS_FILE)) {
    fs.writeFileSync(STATUS_FILE, '{}', 'utf8');
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // API Routes
    if (url.pathname === '/api/status') {
        if (req.method === 'GET') {
            // Read status file
            fs.readFile(STATUS_FILE, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to read status file' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data || '{}');
            });
            return;
        }

        if (req.method === 'POST') {
            // Write status file
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    // Validate JSON
                    JSON.parse(body);
                    fs.writeFile(STATUS_FILE, body, 'utf8', (err) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to write status file' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
    }

    // Static file serving
    let filePath = path.join(DASHBOARD_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(DASHBOARD_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Dashboard server running at http://localhost:${PORT}`);
    console.log(`Status file: ${STATUS_FILE}`);
});
