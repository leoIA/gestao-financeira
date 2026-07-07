const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT) || 3000;
const PHP_PORT = 8001;
const appDir = __dirname;

console.log('=== Gestao Financeira Startup ===');
console.log('App directory:', appDir);
console.log('Node PORT:', PORT);
console.log('PHP PORT:', PHP_PORT);

// Create .env file
const envPath = path.join(appDir, '.env');
const envContent = 'APP_NAME=GestaoFinanceira\n'
  + 'APP_ENV=production\n'
  + 'APP_KEY=\n'
  + 'APP_DEBUG=true\n'
  + 'APP_URL=https://beige-goshawk-642244.hostingersite.com\n'
  + '\n'
  + 'LOG_CHANNEL=stderr\n'
  + 'LOG_LEVEL=debug\n'
  + '\n'
  + 'DB_CONNECTION=pgsql\n'
  + 'DB_HOST=aws-0-sa-east-1.pooler.supabase.com\n'
  + 'DB_PORT=6543\n'
  + 'DB_DATABASE=postgres\n'
  + 'DB_USERNAME=postgres.kqwyhwxtpqnrkxspcmbi\n'
  + 'DB_PASSWORD=mm_construtora\n'
  + 'DB_SSLMODE=require\n'
  + '\n'
  + 'CACHE_DRIVER=file\n'
  + 'FILESYSTEM_DISK=local\n'
  + 'QUEUE_CONNECTION=sync\n'
  + 'SESSION_DRIVER=file\n'
  + 'SESSION_LIFETIME=120\n';

fs.writeFileSync(envPath, envContent);
console.log('.env written.');

// Fix storage permissions
try {
  execSync('chmod -R 777 ' + path.join(appDir, 'storage'), { stdio: 'pipe' });
  execSync('chmod -R 777 ' + path.join(appDir, 'bootstrap/cache'), { stdio: 'pipe' });
  execSync('php artisan storage:link --force', { cwd: appDir, stdio: 'pipe' });
  console.log('Permissions OK.');
} catch (e) {
  console.log('Permission/storage warning:', e.message.substring(0,200));
}

// Generate APP_KEY
try {
  const keyResult = execSync('php artisan key:generate --force --show', { cwd: appDir }).toString().trim();
  console.log('APP_KEY result:', keyResult.substring(0,50));
} catch (e) {
  console.error('key:generate error:', e.stderr ? e.stderr.toString().substring(0,300) : e.message);
}

// Clear caches
try {
  execSync('php artisan config:clear', { cwd: appDir, stdio: 'pipe' });
  execSync('php artisan cache:clear', { cwd: appDir, stdio: 'pipe' });
  console.log('Cache cleared.');
} catch (e) {
  console.log('Cache clear warning:', e.message.substring(0,100));
}

// Start PHP artisan serve
const php = spawn('php', ['artisan', 'serve', '--host=127.0.0.1', '--port=' + PHP_PORT, '--no-interaction'], {
  cwd: appDir,
  env: Object.assign({}, process.env),
  stdio: ['ignore', 'pipe', 'pipe']
});

php.stdout.on('data', d => console.log('[PHP]', d.toString().trim()));
php.stderr.on('data', d => console.error('[PHP ERR]', d.toString().trim()));

php.on('error', (err) => {
  console.error('Failed to start PHP:', err);
  process.exit(1);
});

php.on('exit', (code) => {
  console.error('PHP exited with code:', code);
  process.exit(code || 1);
});

// Proxy function with retry
function proxyRequest(req, res, attempt) {
  const options = {
    hostname: '127.0.0.1',
    port: PHP_PORT,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, {
      'X-Forwarded-For': req.socket.remoteAddress,
      'X-Forwarded-Proto': 'https',
      'Host': req.headers.host
    })
  };
  const proxy = http.request(options, (phpRes) => {
    res.writeHead(phpRes.statusCode, phpRes.headers);
    phpRes.pipe(res, { end: true });
  });
  proxy.on('error', (err) => {
    if (attempt < 3) {
      setTimeout(() => proxyRequest(req, res, attempt + 1), 500);
    } else {
      res.writeHead(502);
      res.end('PHP unavailable: ' + err.message);
    }
  });
  req.pipe(proxy, { end: true });
}

// Start Node proxy server after 3 seconds
setTimeout(() => {
  console.log('Starting Node proxy on port', PORT);
  const server = http.createServer((req, res) => {
    proxyRequest(req, res, 1);
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log('Node proxy listening on port', PORT);
  });
  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
}, 3000);
