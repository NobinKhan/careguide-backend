/**
 * VPS deploy: `bun run deploy` (add `-- --seed` to reset demo data).
 *
 * Safe to re-run on a live server:
 * - never runs `docker compose down`; only the backend is rebuilt and replaced,
 *   MongoDB and Caddy keep running (Caddy is started if it is not up yet)
 * - creates a JWT_SECRET only when .env has none, and never prints secrets
 * - waits for /api/health instead of sleeping a fixed time
 */
import { $ } from 'bun';
import fs from 'node:fs';

const ENV_FILE = '.env';
const PLACEHOLDER_SECRET = 'replace-with-secure-secret';
const HEALTH_TIMEOUT_MS = 90_000;
const shouldSeed = process.argv.includes('--seed');

function randomHex(bytes: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('hex');
}

function readEnvValue(content: string, name: string): string | undefined {
  const match = content.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match?.[1]?.trim() || undefined;
}

/** Make sure .env exists and has a real JWT_SECRET. Returns the parsed file content. */
function ensureEnvFile(): string {
  if (!fs.existsSync(ENV_FILE)) {
    console.log('Creating .env from .env.example...');
    fs.copyFileSync('.env.example', ENV_FILE);
  }
  let content = fs.readFileSync(ENV_FILE, 'utf-8');
  const current = readEnvValue(content, 'JWT_SECRET');
  if (!current || current === PLACEHOLDER_SECRET) {
    const line = `JWT_SECRET=${randomHex(48)}`;
    content = /^JWT_SECRET=.*$/m.test(content)
      ? content.replace(/^JWT_SECRET=.*$/m, line)
      : `${content.replace(/\n?$/, '\n')}${line}\n`;
    fs.writeFileSync(ENV_FILE, content, { encoding: 'utf-8', mode: 0o600 });
    console.log('Generated a new JWT_SECRET in .env (value not shown).');
  }
  fs.chmodSync(ENV_FILE, 0o600);
  return content;
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // The backend image has no shell or curl, so probe it from the Caddy container.
    const res = await $`docker compose exec -T caddy wget -qO- http://backend:3000/api/health`
      .quiet()
      .nothrow();
    if (res.exitCode === 0 && res.stdout.toString().includes('"ok"')) return;
    await Bun.sleep(2000);
  }
  throw new Error(`Backend did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s`);
}

console.log('Care Guide BD backend deploy (Docker Compose: mongo + backend + caddy)');

const envContent = ensureEnvFile();

if (shouldSeed) {
  // Fail before changing anything if the seed would fail anyway.
  for (const name of ['SEED_ADMIN_PASSWORD', 'SEED_USER_PASSWORD']) {
    if (!process.env[name] && !readEnvValue(envContent, name)) {
      console.error(`${name} is not set in .env. Add it before running with --seed.`);
      process.exit(1);
    }
  }
}

console.log('1. Building the backend image and replacing only the backend container...');
await $`docker compose up -d --build backend`;

console.log('2. Making sure Caddy (HTTPS) is running...');
await $`docker compose up -d caddy`;

console.log('3. Waiting for /api/health...');
await waitForHealth();
console.log('   Backend is healthy.');

if (shouldSeed) {
  console.log('4. Resetting demo data with the seeder (passwords read from .env)...');
  // `-e NAME` without a value forwards it from this process's env (Bun loads .env),
  // so passwords never appear on a command line.
  await $`docker compose exec -T -e SEED_RESET=1 -e SEED_ADMIN_EMAIL -e SEED_ADMIN_PASSWORD -e SEED_USER_PASSWORD backend /app/seed`;
} else {
  console.log('4. Skipping seed (pass -- --seed to reset demo data).');
}

const apiDomain = process.env.API_DOMAIN;
if (apiDomain && apiDomain !== 'localhost') {
  const res = await fetch(`https://${apiDomain}/api/health`).catch(() => undefined);
  console.log(
    `5. Public check https://${apiDomain}/api/health -> ${res ? res.status : 'unreachable'}`
  );
}

await $`docker compose ps`;
console.log('Deploy complete.');
