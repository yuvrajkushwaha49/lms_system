const { spawn } = require('child_process');
const path = require('path');

const backendRoot = path.join(__dirname, '..');

const processes = [
  { name: 'identity', script: 'services/identity/server.js' },
  { name: 'user', script: 'services/user/server.js' },
  { name: 'course', script: 'services/course/server.js' },
  { name: 'community', script: 'services/community/server.js' },
  { name: 'content', script: 'services/content/server.js' },
  { name: 'payment', script: 'services/payment/server.js' },
  { name: 'gateway', script: 'services/gateway/server.js', delay: 1500 },
];

const children = [];
const pendingTimers = [];
let isShuttingDown = false;

function killChild(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

function startOne({ name, script, delay = 0 }) {
  const timer = setTimeout(() => {
    if (isShuttingDown) return;
    const child = spawn(process.execPath, [path.join(backendRoot, script)], {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
    });
    child.on('exit', (code) => {
      if (!isShuttingDown && code !== 0 && code !== null) {
        console.error(`[start-all] ${name} exited with code ${code}`);
      }
    });
    children.push({ name, child });
    console.log(`[start-all] started ${name}`);
  }, delay);
  pendingTimers.push(timer);
}

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[start-all] shutting down microservices...');
  pendingTimers.forEach(clearTimeout);
  children.forEach(({ name, child }) => {
    killChild(child);
    console.log(`[start-all] stopped ${name}`);
  });
  setTimeout(() => process.exit(0), 300);
}

processes.forEach(startOne);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  children.forEach(({ child }) => killChild(child));
});
