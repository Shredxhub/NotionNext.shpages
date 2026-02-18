const { execSync } = require('child_process');
const cwd = __dirname;
try {
  console.log('Fetching from origin...');
  execSync('git fetch origin', { cwd, stdio: 'inherit' });
  console.log('Pulling shredxhub.com...');
  execSync('git pull origin shredxhub.com', { cwd, stdio: 'inherit' });
  console.log('Done.');
} catch (e) {
  process.exit(e.status || 1);
}
