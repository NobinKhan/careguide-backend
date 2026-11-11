import mongoose from 'mongoose';
import { connectDB } from './db';
import { UserModel } from './models/User';
import { NoteModel } from './models/Note';
import { PostModel } from './models/Post';

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_RESET !== '1') {
    console.warn('Warning: Refusing to seed database in production without SEED_RESET=1');
    process.exit(1);
  }

  const startTime = performance.now();
  await connectDB();

  console.log('Resetting collections (users, notes, posts, login_throttles)...');
  await Promise.all([
    UserModel.deleteMany({}),
    NoteModel.deleteMany({}),
    PostModel.deleteMany({}),
    mongoose.connection.collection('login_throttles').deleteMany({}),
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
    {
      userId: admin._id,
      title: 'Quarterly Team Planning Checklist',
      content:
        'Finalize holiday schedule, review office workspace layout, and confirm Friday community meetup room.',
    },
    {
      userId: admin._id,
      title: 'Heritage Architecture Walking Tour',
      content:
        'Visit Curzon Hall, Ahsan Manzil, and Lalbagh Fort early Sunday morning for sketching.',
    },
    {
      userId: admin._id,
      title: 'Club Tournament Pairings & Clocks',
      content:
        'Check digital chess clocks, spare batteries, and score sheets before the Friday rapid event.',
    },

    {
      userId: nazrul._id,
      title: 'Chess Opening Repertoire',
      content:
        'Practice Caro-Kann Defense lines and endgame rook positioning for the weekend club match.',
    },
    {
      userId: nazrul._id,
      title: 'Weekend Coding Project Ideas',
      content:
        'Build a personal PGN game viewer and a simple fuel-consumption tracker for long highway rides.',
    },
    {
      userId: nazrul._id,
      title: 'Motorcycle Maintenance Log',
      content: 'Chain lubrication, tire pressure check, and brake fluid inspection at 5,000 km.',
    },
    {
      userId: nazrul._id,
      title: 'Evening Fitness & Stretching Routine',
      content:
        'Thirty minutes of jogging followed by mobility work before late-evening study sessions.',
    },

    {
      userId: rahim._id,
      title: 'Photography Golden Hour Spots',
      content:
        'Buriganga riverfront and Parliament area offer high-contrast silhouettes at sunset.',
    },
    {
      userId: rahim._id,
      title: 'Book Club Reading List',
      content:
        'Finish reading Invisible Cities and prepare discussion questions for next Thursday evening.',
    },
    {
      userId: rahim._id,
      title: 'Darkroom Print & Framing Notes',
      content:
        'Order matte cotton rag paper and 12x18 black aluminum frames for the autumn exhibition.',
    },
    {
      userId: rahim._id,
      title: 'Camera Lens Calibration',
      content: 'Test 50mm f/1.8 prime lens sharpness across aperture stops.',
    },

    {
      userId: karim._id,
      title: 'Sylhet Travel Itinerary',
      content: 'Day 1: Sreemangal tea gardens. Day 2: Lawachara National Park trail.',
    },
    {
      userId: karim._id,
      title: 'Endgame Tactical Puzzles',
      content: 'Opposition and triangulation studies in king and pawn endings.',
    },
    {
      userId: karim._id,
      title: 'Reading Notes: The Shadow Lines',
      content:
        'Trace the family timeline between Dhaka, Calcutta, and London across the second half of the novel.',
    },
    {
      userId: karim._id,
      title: 'Packing Checklist for Coxs Bazar',
      content: 'Power bank, rain jacket, notebook, and compact tripod.',
    },
  ];

  // Insert sequentially so _id timestamps are strictly ordered
  for (const n of notesData) {
    await NoteModel.create(n);
  }

  // 12 Public Posts distributed across users (3 per user)
  const postsData = [
    {
      userId: admin._id,
      title: 'Welcome to Care Guide BD Community Board',
      body: 'Share your weekend plans, book recommendations, travel stories, and hobby updates with fellow members.',
    },
    {
      userId: nazrul._id,
      title: 'Preparing for Autumn Highway Rides',
      body: 'A quick checklist on visor care, reflective vests, and group riding hand signals before heading out at dawn.',
    },
    {
      userId: rahim._id,
      title: 'Capturing Old Dhaka in Morning Light',
      body: 'Walking the narrow lanes between 6:00 AM and 8:00 AM gives the best soft directional light for portraits.',
    },
    {
      userId: karim._id,
      title: 'Dhaka Chess Community Weekly Meetup',
      body: 'Everyone with chess in their interests is welcome to join our Friday rapid tournament.',
    },
    {
      userId: admin._id,
      title: 'Modern Bengali Architecture Highlights',
      body: 'Exploring how red brick, open courtyards, and natural ventilation shape contemporary civic buildings in Dhaka.',
    },
    {
      userId: nazrul._id,
      title: 'Weekend Ride to Mawa Expressway',
      body: 'Early morning ride starting at 6:00 AM. Check tire pressure and safety gear before departure.',
    },
    {
      userId: rahim._id,
      title: 'Street Photography Composition Guide',
      body: 'Leading lines and natural framing help isolate subjects in busy urban environments.',
    },
    {
      userId: karim._id,
      title: 'Five Favourite Travel Memoirs for Long Train Journeys',
      body: 'From Himalayan trail diaries to riverboat chronicles across Bengal, these books make every trip shorter.',
    },
    {
      userId: admin._id,
      title: 'Monthly Community Book Swap This Saturday',
      body: 'Bring up to three books you have finished and trade them over tea in the common lounge at 4:00 PM.',
    },
    {
      userId: nazrul._id,
      title: 'Analysing Classic Endgame Studies Over Coffee',
      body: 'Looking at practical rook-and-pawn endgames where active king play turns a draw into a win.',
    },
    {
      userId: rahim._id,
      title: 'Monsoon Photography Gear Protection',
      body: 'Always carry silica gel packs and a weather-sealed bag when shooting outdoors.',
    },
    {
      userId: karim._id,
      title: 'Backpacking Across Northern Bangladesh',
      body: 'Historical terracotta temples in Puthia and Paharpur are must-visit heritage sites.',
    },
  ];

  for (const p of postsData) {
    await PostModel.create(p);
  }

  const [userIndexes, noteIndexes, postIndexes] = await Promise.all([
    UserModel.collection.indexes(),
    NoteModel.collection.indexes(),
    PostModel.collection.indexes(),
  ]);

  console.log('\n=== ACTIVE DATABASE INDEXES (VERIFIED VIA syncIndexes) ===');
  console.log(
    'users indexes:',
    JSON.stringify(
      userIndexes.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })),
      null,
      2
    )
  );
  console.log(
    'notes indexes:',
    JSON.stringify(
      noteIndexes.map((i) => ({ name: i.name, key: i.key })),
      null,
      2
    )
  );
  console.log(
    'posts indexes:',
    JSON.stringify(
      postIndexes.map((i) => ({ name: i.name, key: i.key })),
      null,
      2
    )
  );

  const elapsedMs = (performance.now() - startTime).toFixed(0);
  console.log(`\nSeed completed deterministically in ${elapsedMs}ms:`);
  console.log(
    '- 4 Users (admin@careguide.bd, nazrul@careguide.bd, rahim@careguide.bd, karim@careguide.bd)'
  );
  console.log('- 15 Private Notes');
  console.log('- 12 Public Posts');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
