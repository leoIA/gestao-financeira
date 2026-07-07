const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT) || 3000;
const PHP_PORT = 8765;
const APP_DIR = __dirname;

// Find PHP binary
function findPhp() {
  const candidates = [
    '/usr/bin/php83',
    '/usr/bin/php8.3',
    '/usr/bin/php82',
    '/usr/bin/php8.2',
    '/usr/bin/php81',
    '/usr/bin/php8.1',
    '/usr/bin/php',
    'php83',
    'php'
  ];
  for (const p of candidates) {
    try {
      require('child_process').execSync(p + ' -v', { stdio: 'ignore' });
      return p;
    } catch (e) {}
  }
  return 'php';
}

const phpBin = findPhp();
console.log('Using PHP binary:', phpBin);

// Setup .env if missing
const envFile = path.join(APP_DIR, '.env');
const envExample = path.join(APP_DIR, '.env.example');
if (!fs.existsSync(envFile)) {
  if (fs.existsSync(envExample)) {
    let env = fs.readFileSync(envExample, 'utf8');
    env = env.replace('DB_CONNECTION=mysql', 'DB_CONNECTION=pgsql');
    env = env.replace('DB_HOST=127.0.0.1', 'DB_HOST=aws-0-sa-east-1.pooler.supabase.com');
    env = env.replace('DB_PORT=3306', 'DB_PORT=6543');
    env = env.replace('DB_DATABASE=laravel', 'DB_DATABASE=postgres');
    env = env.replace('DB_USERNAME=root', 'DB_USERNAME=postgres.cjthfxwmgmtahbbcfzio');
    env = env.replace('DB_PASSWORD=', 'DB_PASSWORD=mm_construtora');
    env = env.replace('APP_ENV=local', 'APP_ENV=production');
    env = env.replace('APP_DEBUG=true', 'APP_DEBUG=false');
    env = env.replace('APP_URL=http://localhost', 'APP_URL=https://beige-goshawk-642244.hostingersite.com');
    fs.writeFileSync(envFile, env);
    console.log('.env created from .env.example');
  }
}

// Generate APP_KEY if missing
try {
  const envContent = fs.readFileSync(envFile, 'utf8');
  if (!envContent.match(/APP_KEY=base64:/)) {
    console.log('Generating APP_KEY...');
    const result = require('child_process').execSync(
      phpBin + ' ' + path.join(APP_DIR, 'artisan') + ' key:generate --force',
      { cwd: APP_DIR, encoding: 'utf8' }
    );
    console.log('APP_KEY result:', result);
  }
} catch (e) {
  console.error('APP_KEY generation error:', e.message);
}

// Fix storage permissions
try {
  require('child_process').execSync('chmod -R 777 ' + path.join(APP_DIR, 'storage'), { stdio: 'ignore' });
  require('child_process').execSync('chmod -R 777 ' + path.join(APP_DIR, 'bootstrap/cache'), { stdio: 'ignore' });
} catch(e) {}

// Start PHP built-in server
const phpServer = spawn(phpBin, [
  '-S', '127.0.0.1:' + PHP_PORT,
  '-t', path.join(APP_DIR, 'public')
], {
  cwd: APP_DIR,
  env: { ...process.env, APP_DIR: APP_DIR }
});

phpServer.stdout.on('data', (d) => console.log('[PHP]', d.toString()));
phpServer.stderr.on('data', (d) => console.log('[PHP]', d.toString()));
phpServer.on('exit', (code) => console.error('[PHP] exited with code', code));

// Wait for PHP to start then launch Node proxy
setTimeout(() => {
  const proxy = http.createServer((req, res) => {
    const options = {
      hostname: '127.0.0.1',
      port: PHP_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e.message);
      res.writeHead(502);
      res.end('Bad Gateway: ' + e.message);
    });
    req.pipe(proxyReq);
  });

  proxy.listen(PORT, '0.0.0.0', () => {
    console.log('Node proxy listening on port', PORT, '-> PHP on', PHP_PORT);
  });
}, 2000);
