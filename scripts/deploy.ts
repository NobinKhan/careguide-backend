import { $ } from 'bun';
import fs from 'node:fs';

console.log('==========================================================');
console.log('Care Guide BD — VPS Docker Deployment & Seeder Automation');
console.log('Runtime: Bun • Database: MongoDB 9 (Latest)');
console.log('==========================================================');

if (!fs.existsSync('.env')) {
  console.log('Creating .env from .env.example...');
  fs.copyFileSync('.env.example', '.env');
}

console.log('1. Building and starting containers via Docker Compose (MongoDB 9)...');
await $`docker compose down`.nothrow();
await $`docker compose up -d --build`;

console.log('2. Waiting for backend and MongoDB 9 to become ready...');
await Bun.sleep(5000);

console.log('3. Running deterministic demo seeder inside the backend container...');
await $`docker compose exec backend /app/seed`;

console.log('4. Checking container status...');
await $`docker compose ps`;

const port = process.env.PORT || 3000;
console.log('==========================================================');
console.log(`Deployment complete! Backend listening on http://localhost:${port}`);
console.log('==========================================================');
