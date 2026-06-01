import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hunter-study-spaces';

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const raw = JSON.parse(
      readFileSync(path.join(__dirname, 'data', 'hunter-all-subjects-schedule.json'), 'utf8')
    );

    console.log('Clearing old schedule documents only from schedules collection...');
    await db.collection('schedules').deleteMany({});
    const result = await db.collection('schedules').insertMany(raw);
    console.log(`Inserted ${result.insertedCount} summer schedule records.`);
  } finally {
    await client.close();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
