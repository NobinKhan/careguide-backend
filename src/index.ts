import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { noteRoutes } from './routes/notes';
import { postRoutes } from './routes/posts';
import { aggregationRoutes } from './routes/aggregations';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'replace-with-secure-secret') {
  console.error(
    'Fatal: JWT_SECRET must be set in .env with at least 32 characters and cannot be the placeholder.'
  );
  process.exit(1);
}

await connectDB();

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = new Hono()
  .use('*', secureHeaders())
  .use('*', cors({ origin: origins }))
  .use(
    '*',
    bodyLimit({
      maxSize: 100 * 1024,
      onError: (c) => c.json({ error: 'Request too large' }, 413),
    })
  )
  .onError((err, c) => {
    if (err instanceof mongoose.Error.CastError) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    if ((err as any)?.code === 11000) {
      return c.json({ error: 'Email is already registered' }, 409);
    }
    console.error(err);
    return c.json({ error: 'Something went wrong' }, 500);
  })
  .notFound((c) => c.json({ error: 'Not found' }, 404))
  .get('/api/health', (c) => c.json({ status: 'ok', service: 'careguide-backend' }))
  .route('/api/auth', authRoutes)
  .route('/api/users', userRoutes)
  .route('/api/notes', noteRoutes)
  .route('/api/posts', postRoutes)
  .route('/api/aggregations', aggregationRoutes);

export type AppType = typeof app;

const port = Number(process.env.PORT) || 3000;
console.log(`Care Guide BD Backend running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
