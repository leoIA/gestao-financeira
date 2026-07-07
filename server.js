const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT) || 3000;
const PHP_PORT = 8001;
const appDir = __dirname;

console.log('=== SERVER STARTING PORT:', PORT, '===');

// Create .env immediately
const envPath = path.join(appDir, '.env');
const envContent = [
  'APP_NAME=GestaoFinanceira',
  'APP_ENV=production',
  'APP_KEY=',
  'APP_DEBUG=true',
  'APP_URL=https://beige-goshawk-642244.hostingersite.com',
  '',
  'LOG_CHANNEL=stderr',
  'LOG_LEVEL=debug',
  '',
  'DB_CONNECTION=pgsql',
  'DB_HOST=aws-0-sa-east-1.pooler.supabase.com',
  'DB_PORT=6543',
  'DB_DATABASE=postgres',
  'DB_USERNAME=postgres.kqwyhwxtpqnrkxspcmbi',
  'DB_PASSWORD=mm_construtora',
  'DB_SSLMODE=require',
  '',
  'CACHE_DRIVER=file',
  'FILESYSTEM_DISK=local',
  'QUEUE_CONNECTION=sync',
  'SESSION_DRIVER=file',
  'SESSION_LIFETIME=120',
].join('\n');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('.env written OK');
} catch(e) {
  console.error('.env write error:', e.message);
}

// Fix permissions
try {
  execSync('chmod -R 777 storage bootstrap/cache', { cwd: appDir, stdio: 'pipe' });
  console.log('chmod OK');
} catch(e) { console.log('chmod warn:', e.message.substring(0,100)); }

// Generate key
try {
  execSync('php artisan key:generate --force', { cwd: appDir, stdio: 'pipe' });
  console.log('key:generate OK');
} catch(e) { console.error('key:generate ERR:', e.stderr ? e.stderr.toString().substring(0,200) : e.message); }

// Start PHP server
const phpArgs = ['artisan', 'serve', '--host=127.0.0.1', '--port=' + PHP_PORT];
console.log('Starting PHP:', phpArgs.join(' '));

const php = spawn('php', phpArgs, {
  cwd: appDir,
  env: process.env,
  detached: false
});

if (php.stdout) php.stdout.on('data', d => process.stdout.write('[PHP] ' + d));
if (php.stderr) php.stderr.on('data', d => process.stderr.write('[PHP] ' + d));
php.on('error', err => { console.error('PHP spawn error:', err); process.exit(1); });
php.on('exit', code => { console.error('PHP exit:', code); });

// Start HTTP server IMMEDIATELY - don't wait for PHP
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OK');
    return;
  }
  
  const options = {
    hostname: '127.0.0.1',
    port: PHP_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  const proxy = http.request(options, phpRes => {
    res.writeHead(phpRes.statusCode, phpRes.headers);
    phpRes.pipe(res, { end: true });
  });
  
  proxy.on('error', err => {
    res.writeHead(503, {'Content-Type': 'text/html'});
    res.end('<h1>Starting...</h1><p>PHP not ready: ' + err.message + '</p><p><a href="/">Refresh</a></p>');
  });
  
  req.pipe(proxy, { end: true });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('HTTP server listening on port', PORT);
});

server.on('error', err => {
  console.error('HTTP server error:', err);
  process.exit(1);
});
