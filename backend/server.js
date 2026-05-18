import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hunter-study-spaces';

let db;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// enable cors
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Seed database with example data
async function seedDatabase() {
  try {
    console.log('Seeding database...');

    // erase existing data
    await db.collection('rooms').deleteMany({});
    await db.collection('classes').deleteMany({});
    console.log('Cleared existing data');

    // sample rooms
    const rooms = [
      {
        floor: 3,
        building: 'East Building',
        capacity: 50,
        room_type: 'Lecture Hall',
        room_number: '301'
      },
      {
        floor: 2,
        building: 'East Building',
        capacity: 30,
        room_type: 'Classroom',
        room_number: '201'
      },
      {
        floor: 4,
        building: 'Thomas Hunter Hall',
        capacity: 25,
        room_type: 'Classroom',
        room_number: '401'
      },
      {
        floor: 3,
        building: 'Thomas Hunter Hall',
        capacity: 40,
        room_type: 'Lecture Hall',
        room_number: '302'
      },
      {
        floor: 1,
        building: 'West Building',
        capacity: 150,
        room_type: 'Lecture Hall',
        room_number: '105'
      },
      {
        floor: 5,
        building: 'West Building',
        capacity: 20,
        room_type: 'Classroom',
        room_number: '501'
      },
      {
        floor: 2,
        building: 'East Building',
        capacity: 35,
        room_type: 'Classroom',
        room_number: '210'
      },
      {
        floor: 4,
        building: 'North Building',
        capacity: 45,
        room_type: 'Computer Lab',
        room_number: '408'
      },
    ];

    const roomsResult = await db.collection('rooms').insertMany(rooms);
    console.log(`Inserted ${roomsResult.insertedCount} rooms`);

    // room IDs for class references
    const insertedRooms = await db.collection('rooms').find({}).toArray();
    const roomIds = insertedRooms.map(r => r._id);

    // sample classes
    const classes = [
      {
        roomId: roomIds[0],
        className: 'CSCI 101 - Intro to CS',
        days: ['Monday', 'Wednesday', 'Friday'],
        startTime: '09:00',
        endTime: '10:00',
      },
      {
        roomId: roomIds[0],
        className: 'CSCI 201 - Data Structures',
        days: ['Tuesday', 'Thursday'],
        startTime: '10:30',
        endTime: '12:00',
      },
      {
        roomId: roomIds[1],
        className: 'MATH 201 - Calculus II',
        days: ['Monday', 'Wednesday'],
        startTime: '13:00',
        endTime: '14:30',
      },
      {
        roomId: roomIds[2],
        className: 'ENG 101 - English Composition',
        days: ['Tuesday', 'Thursday'],
        startTime: '09:00',
        endTime: '10:30',
      },
      {
        roomId: roomIds[3],
        className: 'PHYS 201 - Physics Lab',
        days: ['Wednesday', 'Friday'],
        startTime: '14:00',
        endTime: '16:00',
      },
      {
        roomId: roomIds[4],
        className: 'HIST 101 - World History',
        days: ['Monday', 'Wednesday', 'Friday'],
        startTime: '11:00',
        endTime: '12:00',
      },
      {
        roomId: roomIds[5],
        className: 'PSYCH 101 - Intro to Psychology',
        days: ['Tuesday', 'Thursday'],
        startTime: '13:00',
        endTime: '14:30',
      },
      {
        roomId: roomIds[6],
        className: 'CHEM 101 - Chemistry I',
        days: ['Monday', 'Wednesday'],
        startTime: '10:00',
        endTime: '11:30',
      },
      {
        roomId: roomIds[7],
        className: 'BIO 201 - Biology Lab',
        days: ['Tuesday', 'Thursday'],
        startTime: '14:00',
        endTime: '16:00',
      },
    ];

    const classesResult = await db.collection('classes').insertMany(classes);
    console.log(`Inserted ${classesResult.insertedCount} classes`);
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

app.get('/', (req, res) => {
  res.json({ message: 'Hunter Study Space Finder API is running' });
});

// rooms
// {
//   _id: ,
//   floor: ,
//   building: ,
//   capacity: ,
//   room_type: ,
//   room_number: ,
// }

// classes
// {
//   _id: ObjectId,
//   roomId: ObjectId, // reference to rooms collection
//   className: "CSCI 101",
//   days: ["Monday", "Wednesday"],
//   startTime: "10:00",
//   endTime: "11:30",
// }

async function getAvailableRooms(dayOfWeek, time) {
  try {
    // find all classes scheduled at this time on this day
    const busyClasses = await db.collection('classes').find({
      days: dayOfWeek,
      startTime: { $lte: time },
      endTime: { $gt: time }
    }).toArray();

    // room IDs that are occupied
    const busyRoomIds = busyClasses.map(cls => cls.roomId);

    // all rooms that are NOT occupied
    const availableRooms = await db.collection('rooms').find({
      _id: { $nin: busyRoomIds }
    }).toArray();

    return availableRooms;
  } catch (error) {
    console.error('Error getting available rooms:', error);
    throw error;
  }
}

app.get('/api/available-rooms', async (req, res) => {
  try {
    const { day, time } = req.query; // ?day=Monday&time=10:00
    
    if (!day || !time) {
      return res.status(400).json({ error: 'day and time are required' });
    }
    const available = await getAvailableRooms(day, time);
    res.json(available);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await db.collection('rooms').find({}).toArray();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// add a room
app.post('/api/rooms', async (req, res) => {
  try {
    const room = {
      floor: req.body.floor,
      building: req.body.building,
      capacity: req.body.capacity,
      room_type: req.body.room_type,
      room_number: req.body.room_number,
    };
    const result = await db.collection('rooms').insertOne(room);
    res.status(201).json({ _id: result.insertedId, ...room });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET classes for a specific room
app.get('/api/rooms/:roomId/classes', async (req, res) => {
  try {
    const { roomId } = req.params;
    const classes = await db.collection('classes').find({
      roomId: new ObjectId(roomId)
    }).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all classes
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await db.collection('classes').find({}).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// add a class
app.post('/api/classes', async (req, res) => {
  try {
    let roomId = req.body.roomId;
    
    if (!roomId && req.body.roomNumber) {
      // look up room by room_number
      const room = await db.collection('rooms').findOne({ room_number: req.body.roomNumber });
      
      if (room) {
        roomId = room._id;
      } else {
        // create room if it doesn't exist
        const newRoom = {
          floor: req.body.floor || 1,
          building: req.body.building || 'Unknown Building',
          capacity: req.body.capacity || 30,
          room_type: req.body.roomType || 'Unknown Type',
          room_number: req.body.roomNumber,
        };
        const roomResult = await db.collection('rooms').insertOne(newRoom);
        roomId = roomResult.insertedId;
      }
    }
    
    if (!roomId) {
      return res.status(400).json({ error: 'roomId or roomNumber is required' });
    }

    const classObj = {
      roomId: new ObjectId(roomId),
      className: req.body.className,
      days: req.body.days, // Array: ["Monday", "Wednesday"]
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    };
    const result = await db.collection('classes').insertOne(classObj);
    res.status(201).json({ _id: result.insertedId, ...classObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Filter rooms by time, room type, and building
async function filterRooms(dayOfWeek, time, roomType, building) {
  try {
    // Find all classes scheduled at this time on this day
    const busyClasses = await db.collection('classes').find({
      days: dayOfWeek,
      startTime: { $lte: time },
      endTime: { $gt: time }
    }).toArray();

    // room IDs that are occupied
    const busyRoomIds = busyClasses.map(cls => cls.roomId);

    // build filter
    const filter = {
      _id: { $nin: busyRoomIds }
    };

    if (roomType) {
      filter.room_type = roomType;
      //console.log('Filtering by room type:', roomType);
    }

    if (building) {
      filter.building = building;
      //console.log('Filtering by building:', building);
    }

    const filteredRooms = await db.collection('rooms').find(filter).toArray();
    return filteredRooms;
  } catch (error) {
    console.error('Error filtering rooms:', error);
    throw error;
  }
}

// GET filtered available rooms
app.get('/api/filter-rooms', async (req, res) => {
  try {
    const { day, time, room_type, building } = req.query;
    if (!day || !time) {
      return res.status(400).json({ error: 'day and time are required' });
    }
    const filtered = await filterRooms(day, time, room_type, building);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function start() {
  await connectDB();
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
