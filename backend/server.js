import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hunter-study-spaces';

let db;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ── JSON schedule helpers ─────────────────────────────────────────────────────

function getBuildingFromRoom(room) {
  if (!room) return null;
  const r = room.trim();
  if (/^North\s+Bldg/i.test(r))  return 'North Building';
  if (/^West\s+Bldg/i.test(r))   return 'West Building';
  if (/^East\s+Bldg/i.test(r))   return 'East Building';
  if (/^ThomHunter/i.test(r))    return 'Thomas Hunter Hall';
  if (/^Baker/i.test(r))         return 'Baker Building';
  if (/^Silberman/i.test(r))     return 'Silberman';
  if (/^Roosevelt/i.test(r))     return 'Roosevelt House';
  return null;
}

function parseTimeToMinutes(timeStr) {
  const m = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

const DAY_ABBREVS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseDaysAndTime(str) {
  const spIdx = str.indexOf(' ');
  if (spIdx === -1) return null;
  const daysStr = str.slice(0, spIdx);
  const timePart = str.slice(spIdx + 1);

  const days = [];
  for (let i = 0; i < daysStr.length; i += 2) {
    const ab = daysStr.slice(i, i + 2);
    if (DAY_ABBREVS.includes(ab)) days.push(ab);
  }
  if (!days.length) return null;

  const parts = timePart.split(' - ');
  if (parts.length < 2) return null;
  const startMinutes = parseTimeToMinutes(parts[0].trim());
  const endMinutes   = parseTimeToMinutes(parts[1].trim());
  if (startMinutes === null || endMinutes === null) return null;

  return { days, startMinutes, endMinutes };
}

function getRoomNumber(room) {
  const parts = room.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function getFloor(roomNumber) {
  const m = roomNumber.match(/\d+/);
  if (!m) return 1;
  const firstDigit = parseInt(m[0][0]);
  return firstDigit || 1;
}

function minutesToTimeStr(minutes) {
  const h    = Math.floor(minutes / 60);
  const min  = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

// ── Load + preprocess schedule ─────────────────────────────────────────────────

let schedule = [];

function processRaw(raw) {
  return raw
    .map(s => ({
      ...s,
      building:   getBuildingFromRoom(s.room),
      timeBlocks: (s.daysAndTimes || []).map(parseDaysAndTime).filter(Boolean),
    }))
    .filter(s => s.building !== null);
}

async function loadSchedule() {
  if (db) {
    try {
      const raw = await db.collection('schedules').find({}, { projection: { _id: 0 } }).toArray();
      if (raw.length > 0) {
        schedule = processRaw(raw);
        console.log(`Loaded ${schedule.length} sections from MongoDB (${raw.length - schedule.length} skipped)`);
        return;
      }
    } catch (err) {
      console.warn('Could not load schedule from MongoDB:', err.message);
    }
  }

  try {
    const raw = JSON.parse(
      readFileSync(path.join(__dirname, 'data', 'hunter-all-subjects-schedule.json'), 'utf8')
    );
    schedule = processRaw(raw);
    console.log(`Loaded ${schedule.length} sections from JSON (${raw.length - schedule.length} skipped)`);
  } catch (err) {
    console.warn('Could not load schedule JSON:', err.message);
  }
}

const DAY_NAME_TO_ABBREV = {
  Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th',
  Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su',
};

function computeAvailability(room, dayAbbrev, timeMinutes) {
  let nextStart = Infinity;
  let nextTopic = null;
  for (const s of schedule) {
    if (s.room !== room) continue;
    for (const b of s.timeBlocks) {
      if (b.days.includes(dayAbbrev) && b.startMinutes > timeMinutes) {
        if (b.startMinutes < nextStart) {
          nextStart = b.startMinutes;
          nextTopic = s.courseTopic || s.subjectCode || null;
        }
      }
    }
  }
  if (nextStart === Infinity) {
    return { nextClass: null, availableFor: null, nextTopic: null };
  }
  return {
    nextClass:    minutesToTimeStr(nextStart),
    availableFor: nextStart - timeMinutes,
    nextTopic,
  };
}

// ── JSON-based API routes ─────────────────────────────────────────────────────

// GET /api/rooms/schedule?room=...&day=Monday&time=14:30  →  upcoming classes for a room
app.get('/api/rooms/schedule', (req, res) => {
  const { room, day, time } = req.query;
  if (!room || !day || !time) {
    return res.status(400).json({ error: 'room, day, and time are required' });
  }
  const dayAbbrev = DAY_NAME_TO_ABBREV[day] ?? day;
  const [hStr, mStr] = time.split(':');
  const timeMinutes = parseInt(hStr) * 60 + parseInt(mStr || '0');

  const upcoming = [];
  for (const s of schedule) {
    if (s.room !== room) continue;
    for (const b of s.timeBlocks) {
      if (b.days.includes(dayAbbrev) && b.endMinutes > timeMinutes) {
        upcoming.push({
          courseTopic: s.courseTopic || s.subjectCode,
          subjectCode: s.subjectCode,
          section:     s.section,
          instructor:  s.instructor,
          startTime:   minutesToTimeStr(b.startMinutes),
          endTime:     minutesToTimeStr(b.endMinutes),
          startMinutes: b.startMinutes,
          isCurrent:   b.startMinutes <= timeMinutes,
        });
      }
    }
  }

  upcoming.sort((a, b) => a.startMinutes - b.startMinutes);
  res.json(upcoming.map(({ startMinutes, ...rest }) => rest));
});

// GET /api/rooms/buildings  →  ["Baker Building", "East Building", ...]
app.get('/api/rooms/buildings', (req, res) => {
  const buildings = [...new Set(schedule.map(s => s.building))].sort();
  res.json(buildings);
});

// GET /api/rooms/available?building=West%20Building&day=Tuesday&time=14:30
app.get('/api/rooms/available', (req, res) => {
  const { building, day, time } = req.query;
  if (!day || !time) {
    return res.status(400).json({ error: 'day and time query params are required' });
  }

  const dayAbbrev = DAY_NAME_TO_ABBREV[day] ?? day;
  const [hStr, mStr] = time.split(':');
  const timeMinutes = parseInt(hStr) * 60 + parseInt(mStr || '0');

  // Find rooms occupied at this moment
  const occupied = new Set();
  for (const s of schedule) {
    if (building && s.building !== building) continue;
    for (const b of s.timeBlocks) {
      if (
        b.days.includes(dayAbbrev) &&
        timeMinutes >= b.startMinutes &&
        timeMinutes < b.endMinutes
      ) {
        occupied.add(s.room);
      }
    }
  }

  // Collect unique rooms in the requested building
  const roomMap = new Map();
  for (const s of schedule) {
    if (building && s.building !== building) continue;
    if (!roomMap.has(s.room)) roomMap.set(s.room, s.building);
  }

  // Return rooms that are not occupied, with availability info
  const results = [];
  for (const [room, bldg] of roomMap) {
    if (occupied.has(room)) continue;
    const roomNumber = getRoomNumber(room);
    const { nextClass, availableFor } = computeAvailability(room, dayAbbrev, timeMinutes);
    results.push({
      id:           room,
      building:     bldg,
      roomNumber,
      floor:        getFloor(roomNumber),
      availableFor,
      nextClass,
      type:         'Classroom',
    });
  }

  results.sort((a, b) => b.availableFor - a.availableFor);
  res.json(results);
});

// GET /api/debug/summary
app.get('/api/debug/summary', (_req, res) => {
  const rooms   = [...new Set(schedule.map(s => s.room))];
  const codes   = [...new Set(schedule.map(s => s.subjectCode))].sort();
  const sample  = rooms.slice(0, 10);
  res.json({
    totalSections: schedule.length,
    totalRooms:    rooms.length,
    subjectCodes:  codes,
    sampleRooms:   sample,
  });
});

// GET /api/debug/room/:room
app.get('/api/debug/room/:room', (req, res) => {
  const roomId   = req.params.room;
  const day      = req.query.day  || 'Monday';
  const time     = req.query.time || '12:00';
  const dayAbbrev = DAY_NAME_TO_ABBREV[day] ?? day;
  const [hStr, mStr] = time.split(':');
  const timeMinutes  = parseInt(hStr) * 60 + parseInt(mStr || '0');

  const sections = schedule.filter(s => s.room === roomId);
  const blocks   = sections.flatMap(s =>
    s.timeBlocks.map(b => ({
      courseTopic: s.courseTopic,
      subjectCode: s.subjectCode,
      days: b.days,
      startMinutes: b.startMinutes,
      endMinutes:   b.endMinutes,
      startTime:    minutesToTimeStr(b.startMinutes),
      endTime:      minutesToTimeStr(b.endMinutes),
    }))
  );

  const isOccupied = blocks.some(b =>
    b.days.includes(dayAbbrev) && timeMinutes >= b.startMinutes && timeMinutes < b.endMinutes
  );
  const avail = computeAvailability(roomId, dayAbbrev, timeMinutes);

  res.json({
    room: roomId,
    queriedDay: day,
    queriedTime: time,
    totalSections: sections.length,
    allBlocks: blocks,
    isOccupiedAt: isOccupied,
    availability: avail,
  });
});

// GET /api/rooms/all  →  all unique rooms (used for favorites display)
app.get('/api/rooms/all', (req, res) => {
  const roomMap = new Map();
  for (const s of schedule) {
    if (!roomMap.has(s.room)) {
      const roomNumber = getRoomNumber(s.room);
      roomMap.set(s.room, {
        id:          s.room,
        building:    s.building,
        roomNumber,
        floor:       getFloor(roomNumber),
        availableFor: 0,
        nextClass:   '—',
        type:        'Classroom',
      });
    }
  }
  const rooms = [...roomMap.values()].sort((a, b) =>
    a.building.localeCompare(b.building) || a.roomNumber.localeCompare(b.roomNumber)
  );
  res.json(rooms);
});

// ── MongoDB connection ────────────────────────────────────────────────────────

async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.warn('MongoDB unavailable — running without database:', error.message);
  }
}

// ── MongoDB-based routes (legacy) ─────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ message: 'Hunter Study Space Finder API is running' });
});

app.get('/api/available-rooms', async (req, res) => {
  try {
    const { day, time } = req.query;
    if (!day || !time) return res.status(400).json({ error: 'day and time are required' });
    const busyClasses = await db.collection('classes').find({
      days: day, startTime: { $lte: time }, endTime: { $gt: time },
    }).toArray();
    const busyRoomIds = busyClasses.map(c => c.roomId);
    const available = await db.collection('rooms').find({ _id: { $nin: busyRoomIds } }).toArray();
    res.json(available);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await db.collection('rooms').find({}).toArray();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const room = {
      floor: req.body.floor, building: req.body.building,
      capacity: req.body.capacity, room_type: req.body.room_type, room_number: req.body.room_number,
    };
    const result = await db.collection('rooms').insertOne(room);
    res.status(201).json({ _id: result.insertedId, ...room });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:roomId/classes', async (req, res) => {
  try {
    const classes = await db.collection('classes').find({
      roomId: new ObjectId(req.params.roomId),
    }).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    const classes = await db.collection('classes').find({}).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/classes', async (req, res) => {
  try {
    let roomId = req.body.roomId;
    if (!roomId && req.body.roomNumber) {
      const room = await db.collection('rooms').findOne({ room_number: req.body.roomNumber });
      if (room) {
        roomId = room._id;
      } else {
        const newRoom = {
          floor: req.body.floor || 1, building: req.body.building || 'Unknown',
          capacity: req.body.capacity || 30, room_type: req.body.roomType || 'Unknown',
          room_number: req.body.roomNumber,
        };
        const r = await db.collection('rooms').insertOne(newRoom);
        roomId = r.insertedId;
      }
    }
    if (!roomId) return res.status(400).json({ error: 'roomId or roomNumber is required' });
    const classObj = {
      roomId: new ObjectId(roomId), className: req.body.className,
      days: req.body.days, startTime: req.body.startTime, endTime: req.body.endTime,
    };
    const result = await db.collection('classes').insertOne(classObj);
    res.status(201).json({ _id: result.insertedId, ...classObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filter-rooms', async (req, res) => {
  try {
    const { day, time, room_type, building } = req.query;
    if (!day || !time) return res.status(400).json({ error: 'day and time are required' });
    const busyClasses = await db.collection('classes').find({
      days: day, startTime: { $lte: time }, endTime: { $gt: time },
    }).toArray();
    const busyRoomIds = busyClasses.map(c => c.roomId);
    const filter = { _id: { $nin: busyRoomIds } };
    if (room_type) filter.room_type = room_type;
    if (building) filter.building = building;
    const rooms = await db.collection('rooms').find(filter).toArray();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  await connectDB();
  await loadSchedule();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
