import { $ } from 'bun';
import fs from 'node:fs';

console.log('==========================================================');
console.log('Care Guide BD — VPS Docker Deployment & Seeder Automation');
console.log('Runtime: Bun • Database: MongoDB 9 (Latest)');
console.log('==========================================================');

if (!fs.existsSync('.env')) {
  console.log('Creating .env from .env.example...');
  let content = fs.readFileSync('.env.example', 'utf-8');
  const generatedSecret =
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  content = content.replace(
    'JWT_SECRET=replace-with-secure-secret',
    `JWT_SECRET=${generatedSecret}`
  );
  fs.writeFileSync('.env', content, 'utf-8');
  console.log('generated a new JWT_SECRET in .env');
}

console.log('1. Building and starting containers via Docker Compose (MongoDB 9)...');
await $`docker compose down`.nothrow();
await $`docker compose up -d --build`;

console.log('2. Waiting for backend and MongoDB 9 to become ready...');
await Bun.sleep(5000);

const shouldSeed = process.argv.includes('--seed');
if (shouldSeed) {
  console.log('3. Running deterministic demo seeder inside the backend container...');
  await $`docker compose exec -e SEED_RESET=1 backend /app/seed`;
} else {
  console.log('3. Skipping seed (pass --seed to reset demo data)');
}

console.log('4. Checking container status...');
await $`docker compose ps`;

const port = process.env.PORT || 3000;
console.log('==========================================================');
console.log(`Deployment complete! Backend listening on http://localhost:${port}`);
console.log('==========================================================');
