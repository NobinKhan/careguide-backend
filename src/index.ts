import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectDB } from './db';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { noteRoutes } from './routes/notes';
import { postRoutes } from './routes/posts';
import { aggregationRoutes } from './routes/aggregations';

await connectDB();

const app = new Hono()
  .use('*', cors())
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
