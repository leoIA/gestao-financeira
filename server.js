const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT) || 3000;
const APP_DIR = __dirname;
const PHP_PORT = 8765;

// Kill process on port
function killPort(port) {
  try { execSync('fuser -k ' + port + '/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e) {}
  try { execSync('pkill -f "php.*' + port + '" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e) {}
}

// Find PHP binary - prefer php81
function findPhp() {
  const candidates = ['/usr/bin/php81', '/usr/bin/php8.1', '/usr/bin/php82', '/usr/bin/php8.2', '/usr/bin/php80', '/usr/bin/php', 'php81', 'php'];
  for (const p of candidates) {
    try { execSync(p + ' -v', { stdio: 'ignore' }); console.log('Found PHP:', p); return p; } catch(e) {}
  }
  return 'php';
}

const phpBin = findPhp();
console.log('PHP binary:', phpBin);

// Kill any existing PHP processes on the port
killPort(PHP_PORT);

// Build .env from Hostinger env vars
const envFile = path.join(APP_DIR, '.env');
const envVars = {
  APP_NAME: process.env.APP_NAME || 'GestaoFinanceira',
  APP_ENV: process.env.APP_ENV || 'production',
  APP_KEY: process.env.APP_KEY || '',
  APP_DEBUG: process.env.APP_DEBUG || 'false',
  APP_URL: process.env.APP_URL || 'https://beige-goshawk-642244.hostingersite.com',
  LOG_CHANNEL: process.env.LOG_CHANNEL || 'stack',
  DB_CONNECTION: process.env.DB_CONNECTION || 'pgsql',
  DB_HOST: process.env.DB_HOST || 'aws-1-sa-east-1.pooler.supabase.com',
  DB_PORT: process.env.DB_PORT || '5432',
  DB_DATABASE: process.env.DB_DATABASE || 'postgres',
  DB_USERNAME: process.env.DB_USERNAME || 'postgres.kqwyhwxtpqnrkxspcmbi',
  DB_PASSWORD: process.env.DB_PASSWORD || 'mm_construtora',
  BROADCAST_DRIVER: 'log',
  CACHE_DRIVER: process.env.CACHE_DRIVER || 'file',
  QUEUE_CONNECTION: process.env.QUEUE_CONNECTION || 'sync',
  SESSION_DRIVER: process.env.SESSION_DRIVER || 'file',
  SESSION_LIFETIME: '120'
};

fs.writeFileSync(envFile, Object.entries(envVars).map(([k,v]) => k+'='+v).join('\n') + '\n');
console.log('.env written, APP_KEY:', envVars.APP_KEY ? 'SET' : 'EMPTY');

// Generate APP_KEY if missing
try {
  const cur = fs.readFileSync(envFile, 'utf8');
  if (!cur.match(/APP_KEY=base64:/)) {
    console.log('Generating APP_KEY...');
    const out = execSync(phpBin + ' ' + path.join(APP_DIR, 'artisan') + ' key:generate --force', { cwd: APP_DIR, encoding: 'utf8' });
    console.log(out.trim());
  }
} catch(e) { console.error('APP_KEY error:', e.message); }

// Fix permissions
try { execSync('chmod -R 777 ' + path.join(APP_DIR, 'storage') + ' ' + path.join(APP_DIR, 'bootstrap/cache')); } catch(e) {}

// Clear config cache
try { execSync(phpBin + ' ' + path.join(APP_DIR, 'artisan') + ' config:clear --no-interaction', { cwd: APP_DIR }); } catch(e) { console.error('config:clear error:', e.message); }

// Start PHP built-in server
console.log('Starting PHP on port', PHP_PORT);
const phpServer = spawn(phpBin, ['-S', '127.0.0.1:' + PHP_PORT, '-t', path.join(APP_DIR, 'public')], {
  cwd: APP_DIR,
  env: Object.assign({}, process.env)
});
phpServer.stdout.on('data', d => process.stdout.write('[PHP] ' + d));
phpServer.stderr.on('data', d => process.stderr.write('[PHP] ' + d));
phpServer.on('exit', (code, sig) => console.error('[PHP] exited code=' + code + ' sig=' + sig));

// Node.js proxy -> PHP
setTimeout(() => {
  console.log('Starting Node proxy on', PORT);
  http.createServer((req, res) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PHP_PORT,
      path: req.url,
      method: req.method,
      headers: Object.assign({}, req.headers, { host: '127.0.0.1:' + PHP_PORT })
    };
    const pr = http.request(opts, (pres) => {
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    });
    pr.on('error', e => {
      console.error('Proxy error:', e.message);
      res.writeHead(502);
      res.end('PHP not ready: ' + e.message);
    });
    req.pipe(pr);
  }).listen(PORT, '0.0.0.0', () => console.log('Listening on', PORT));
}, 2000);
