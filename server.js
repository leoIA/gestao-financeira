const { spawn, execSync } = require('child_process');
const path = require('path');

const port = process.env.PORT || 3000;
const appDir = __dirname;
const publicPath = path.join(appDir, 'public');

// Run artisan setup before starting PHP server
try {
    console.log('Generating app key...');
    execSync('php artisan key:generate --force', { cwd: appDir, stdio: 'inherit' });
    console.log('Running migrations...');
    execSync('php artisan migrate --force', { cwd: appDir, stdio: 'inherit' });
    console.log('Caching config...');
    execSync('php artisan config:cache', { cwd: appDir, stdio: 'inherit' });
    console.log('Artisan setup complete.');
} catch (e) {
    console.error('Artisan setup error (continuing):', e.message);
}

console.log('Starting PHP server on port ' + port);
console.log('Public path: ' + publicPath);

const php = spawn('php', ['-S', '0.0.0.0:' + port, '-t', publicPath], {
    cwd: appDir,
    stdio: 'inherit',
    env: process.env
});

php.on('error', function(err) {
    console.error('Erro ao iniciar PHP:', err);
    process.exit(1);
});

php.on('close', function(code) {
    process.exit(code || 0);
});
