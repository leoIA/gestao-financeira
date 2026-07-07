const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const PHP_PORT = 9000;
const appDir = __dirname;
const publicPath = path.join(appDir, 'public');

console.log('App directory:', appDir);
console.log('Public path:', publicPath);

// Create .env file with correct settings
const envPath = path.join(appDir, '.env');
if (!fs.existsSync(envPath)) {
  console.log('Creating .env file...');
  const envContent = `APP_NAME=GestaoFinanceira
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://beige-goshawk-642244.hostingersite.com

LOG_CHANNEL=stderr
LOG_LEVEL=error

DB_CONNECTION=pgsql
DB_HOST=aws-0-sa-east-1.pooler.supabase.com
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.kqwyhwxtpqnrkxspcmbi
DB_PASSWORD=mm_construtora

CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120
`;
  fs.writeFileSync(envPath, envContent);
  console.log('.env created.');
} else {
  console.log('.env already exists.');
}

// Fix storage permissions
try {
  execSync('chmod -R 775 ' + path.join(appDir, 'storage'), { stdio: 'inherit' });
  execSync('chmod -R 775 ' + path.join(appDir, 'bootstrap/cache'), { stdio: 'inherit' });
  console.log('Permissions fixed.');
} catch (e) {
  console.log('Permission fix skipped:', e.message);
}

// Generate APP_KEY if not set
try {
  execSync('php artisan key:generate --force', { cwd: appDir, stdio: 'inherit' });
  console.log('APP_KEY generated.');
} catch (e) {
  console.error('key:generate error:', e.message);
}

// Run migrations
try {
  execSync('php artisan migrate --force', { cwd: appDir, stdio: 'inherit' });
  console.log('Migrations complete.');
} catch (e) {
  console.error('Migration error (continuing):', e.message);
}

// Cache config
try {
  execSync('php artisan config:cache', { cwd: appDir, stdio: 'inherit' });
  execSync('php artisan route:cache', { cwd: appDir, stdio: 'inherit' });
  console.log('Config cached.');
} catch (e) {
  console.error('Cache error (continuing):', e.message);
}

// Start PHP built-in server
const php = spawn('php', ['-S', '127.0.0.1:' + PHP_PORT, '-t', publicPath], {
  cwd: appDir,
  stdio: 'inherit',
  env: process.env
});

php.on('error', (err) => {
  console.error('Failed to start PHP server:', err);
  process.exit(1);
});

// Wait a moment for PHP to start, then start Node proxy
setTimeout(() => {
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
}, 2000);
