import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MONGODB_URI    = process.env.MONGODB_URI || 'mongodb://localhost:27017/hunter-study-spaces';
const INVENTORY_FILE = path.join(__dirname, 'data', 'hunter-room-inventory-spring-2026.json');
const SOURCE_TERM    = '2026 Spring Term';

async function seedRooms() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db  = client.db();
    const raw = JSON.parse(readFileSync(INVENTORY_FILE, 'utf8'));
    const now = new Date();

    const docs = raw.map(r => ({
      ...r,
      sourceTerm: SOURCE_TERM,
      createdAt:  now,
      updatedAt:  now,
    }));

    console.log('Clearing old room inventory from room_inventory collection...');
    await db.collection('room_inventory').deleteMany({});
    const result = await db.collection('room_inventory').insertMany(docs);
    console.log(`Inserted ${result.insertedCount} rooms into room_inventory.`);

    // Verify nothing else was touched
    const schedulesCount = await db.collection('schedules').countDocuments();
    const studentsCount  = await db.collection('students').countDocuments();
    console.log(`schedules collection: ${schedulesCount} docs (untouched)`);
    console.log(`students collection:  ${studentsCount} docs (untouched)`);
  } finally {
    await client.close();
  }
}

seedRooms().catch(err => {
  console.error('seed:rooms failed:', err.message);
  process.exit(1);
});
