import mongoose from 'mongoose';
import { connectDB } from './db';
import { UserModel } from './models/User';
import { NoteModel } from './models/Note';
import { PostModel } from './models/Post';

async function seed() {
  const startTime = performance.now();
  await connectDB();

  console.log('Resetting collections (users, notes, posts)...');
  await Promise.all([
    UserModel.deleteMany({}),
    NoteModel.deleteMany({}),
    PostModel.deleteMany({}),
  ]);

  console.log('Synchronizing explicit schema indexes via mongoose.connection.syncIndexes()...');
  await mongoose.connection.syncIndexes();

  const [adminHash, userHash] = await Promise.all([
    Bun.password.hash('Admin@123', { algorithm: 'bcrypt', cost: 10 }),
    Bun.password.hash('User@123', { algorithm: 'bcrypt', cost: 10 }),
  ]);

  const users = await UserModel.insertMany([
    {
      name: 'System Admin',
      email: 'admin@careguide.bd',
      passwordHash: adminHash,
      role: 'admin',
      interests: ['architecture', 'chess', 'reading'],
    },
    {
      name: 'Kazi Nazrul',
      email: 'nazrul@careguide.bd',
      passwordHash: userHash,
      role: 'user',
      interests: ['chess', 'coding', 'motorcycles'],
    },
    {
      name: 'Abdur Rahim',
      email: 'rahim@careguide.bd',
      passwordHash: userHash,
      role: 'user',
      interests: ['reading', 'coding', 'photography'],
    },
    {
      name: 'Abdul Karim',
      email: 'karim@careguide.bd',
      passwordHash: userHash,
      role: 'user',
      interests: ['chess', 'reading', 'travel'],
    },
  ]);

  const [admin, nazrul, rahim, karim] = users;

  // 15 Private Notes distributed across Admin (3), Nazrul (4), Rahim (4), Karim (4)
  const notesData = [
    { userId: admin._id, title: 'Admin Security Audit Checklist', content: 'Verify JWT HS256 expiry and role-based middleware guards across /api/users and /api/notes/all.' },
    { userId: admin._id, title: 'MongoDB Indexing Review Notes', content: 'Confirmed only 4 explicit custom indexes exist across users, notes, and posts collections.' },
    { userId: admin._id, title: 'VPS Deployment Runbook', content: 'Deploy Hono + Bun service behind reverse proxy and verify globalThis Mongoose connection pool.' },

    { userId: nazrul._id, title: 'Chess Opening Repertoire', content: 'Practice Caro-Kann Defense lines and endgame rook positioning for weekend club match.' },
    { userId: nazrul._id, title: 'Bun + Hono RPC Notes', content: 'Use Bun.password.hash with bcrypt cost 10 and hono/jwt to avoid external npm dependencies.' },
    { userId: nazrul._id, title: 'Motorcycle Maintenance Log', content: 'Chain lubrication, tire pressure check, and brake fluid inspection at 5,000 km.' },
    { userId: nazrul._id, title: 'SolidJS v2 Signals Study', content: 'Remember: components run once, never destructure props, and use createSignal/createMemo.' },

    { userId: rahim._id, title: 'Photography Golden Hour Spots', content: 'Buriganga riverfront and Parliament area offer high-contrast silhouettes at sunset.' },
    { userId: rahim._id, title: 'Book Club Reading List', content: 'Finish Designing Data-Intensive Applications Chapters 3 and 4 on B-Trees and LSM-Trees.' },
    { userId: rahim._id, title: 'TypeScript Strict Mode Tips', content: 'Derive model types with InferSchemaType<typeof schema> to prevent schema-interface drift.' },
    { userId: rahim._id, title: 'Camera Lens Calibration', content: 'Test 50mm f/1.8 prime lens sharpness across aperture stops.' },

    { userId: karim._id, title: 'Sylhet Travel Itinerary', content: 'Day 1: Sreemangal tea gardens. Day 2: Lawachara National Park trail.' },
    { userId: karim._id, title: 'Endgame Tactical Puzzles', content: 'Opposition and triangulation studies in king and pawn endings.' },
    { userId: karim._id, title: 'Reading Notes: Clean Architecture', content: 'Keep domain boundaries explicit while avoiding unnecessary repository boilerplate.' },
    { userId: karim._id, title: 'Packing Checklist for Coxs Bazar', content: 'Power bank, rain jacket, notebook, and compact tripod.' },
  ];

  // Insert sequentially so _id timestamps are strictly ordered
  for (const n of notesData) {
    await NoteModel.create(n);
  }

  // 12 Public Posts distributed across users (3 per user)
  const postsData = [
    { userId: admin._id, title: 'Welcome to Care Guide BD Engineering Portal', body: 'This portal demonstrates role-based access control, ESR-compliant MongoDB indexing, and single-pipeline aggregations.' },
    { userId: nazrul._id, title: 'Why MongoDB ObjectId Sorting Beats Extra createdAt Indexes', body: 'The first 4 bytes of every MongoDB ObjectId encode a Unix timestamp, allowing chronological sorting via the free _id_ index.' },
    { userId: rahim._id, title: 'Understanding Multikey Indexes in MongoDB', body: 'Indexing an array field like interests creates a multikey index that accelerates $match and $unwind aggregation stages.' },
    { userId: karim._id, title: 'Dhaka Chess Community Weekly Meetup', body: 'Everyone with chess in their interests is welcome to join our Friday rapid tournament.' },
    { userId: admin._id, title: 'ESR Rule: Equality, Sort, Range Explained', body: 'Compound index { userId: 1, _id: -1 } satisfies equality on userId and sort order on _id with zero in-memory blocking sort.' },
    { userId: nazrul._id, title: 'Weekend Ride to Mawa Expressway', body: 'Early morning ride starting at 6:00 AM. Check tire pressure and safety gear before departure.' },
    { userId: rahim._id, title: 'Street Photography Composition Guide', body: 'Leading lines and natural framing help isolate subjects in busy urban environments.' },
    { userId: karim._id, title: 'Top 5 Technical Books for Backend Engineers', body: 'Database Internals and Designing Data-Intensive Applications remain essential reading.' },
    { userId: admin._id, title: 'Optimizing $lookup Pipelines in MongoDB', body: 'Pairing $lookup with a compound { userId: 1, _id: -1 } index on the foreign collection makes user-posts aggregation super fast.' },
    { userId: nazrul._id, title: 'Benchmarking Bun Native Password Hashing', body: 'Bun.password.hash provides native C/Zig bcrypt hashing without native node-gyp compilation issues.' },
    { userId: rahim._id, title: 'Monsoon Photography Gear Protection', body: 'Always carry silica gel packs and a weather-sealed bag when shooting outdoors.' },
    { userId: karim._id, title: 'Backpacking Across Northern Bangladesh', body: 'Historical terracotta temples in Puthia and Paharpur are must-visit heritage sites.' },
  ];

  for (const p of postsData) {
    await PostModel.create(p);
  }

  const [userIndexes, noteIndexes, postIndexes] = await Promise.all([
    UserModel.collection.indexes(),
    NoteModel.collection.indexes(),
    PostModel.collection.indexes(),
  ]);

  console.log('\n=== ACTIVE MONGODB INDEXES (VERIFIED VIA syncIndexes) ===');
  console.log('users indexes:', JSON.stringify(userIndexes.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })), null, 2));
  console.log('notes indexes:', JSON.stringify(noteIndexes.map((i) => ({ name: i.name, key: i.key })), null, 2));
  console.log('posts indexes:', JSON.stringify(postIndexes.map((i) => ({ name: i.name, key: i.key })), null, 2));

  const elapsedMs = (performance.now() - startTime).toFixed(0);
  console.log(`\nSeed completed deterministically in ${elapsedMs}ms:`);
  console.log('- 4 Users (admin@careguide.bd, nazrul@careguide.bd, rahim@careguide.bd, karim@careguide.bd)');
  console.log('- 15 Private Notes');
  console.log('- 12 Public Posts');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
