const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PHP_PORT = 9000;
const appDir = __dirname;
const publicPath = path.join(appDir, 'public');

console.log('App directory:', appDir);
console.log('Public path:', publicPath);

// Run artisan setup
try {
    execSync('php artisan key:generate --force', { cwd: appDir, stdio: 'inherit' });
    execSync('php artisan migrate --force', { cwd: appDir, stdio: 'inherit' });
    execSync('php artisan config:cache', { cwd: appDir, stdio: 'inherit' });
    console.log('Artisan setup complete.');
} catch (e) {
    console.error('Artisan setup error (continuing):', e.message);
}

// Start PHP built-in server on internal port
const php = spawn('php', ['-S', '127.0.0.1:' + PHP_PORT, '-t', publicPath], {
    cwd: appDir,
    stdio: 'inherit',
    env: process.env
});

// Create Node.js HTTP proxy server
const server = http.createServer((req, res) => {
    const options = {
        hostname: '127.0.0.1',
        port: PHP_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    };
    const proxy = http.request(options, (phpRes) => {
        res.writeHead(phpRes.statusCode, phpRes.headers);
        phpRes.pipe(res, { end: true });
    });
    proxy.on('error', (err) => {
        res.writeHead(502);
        res.end('PHP server error: ' + err.message);
    });
    req.pipe(proxy, { end: true });
});

server.listen(PORT, () => {
    console.log('Node.js proxy listening on port ' + PORT);
});

php.on('error', (err) => {
    console.error('PHP error:', err);
});
