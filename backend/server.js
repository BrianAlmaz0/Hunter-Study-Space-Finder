import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hunter-study-spaces';
const JWT_SECRET = process.env.JWT_SECRET || 'hunter-study-spaces-dev-secret';

let db;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

const ALLOWED_DOMAINS = ['login.cuny.edu', 'hunter.cuny.edu', 'myhunter.cuny.edu'];
const isValidCunyEmail = (email) =>
  ALLOWED_DOMAINS.some(d => email.toLowerCase().trim().endsWith(`@${d}`));
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// ── Email transporter ─────────────────────────────────────────────────────────
// To enable real emails: add EMAIL_USER and EMAIL_PASS to backend/.env
// For Gmail use an App Password: https://myaccount.google.com/apppasswords
// EMAIL_FROM is optional (e.g. "Hunter Study Spaces <you@gmail.com>")
const emailTransporter = process.env.EMAIL_USER
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
  : null;

async function sendVerificationEmail(email, code) {
  if (!emailTransporter) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return;
  }
  await emailTransporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Hunter Study Spaces – Verify Your Email',
    text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Your verification code is: <strong style="font-size:22px;letter-spacing:4px">${code}</strong></p><p>This code expires in 15 minutes.</p>`,
  });
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });

  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required.' });

  const normalizedEmail = email.toLowerCase().trim();
  if (!isValidCunyEmail(normalizedEmail))
    return res.status(400).json({ error: 'Email must be a Hunter/CUNY address (@login.cuny.edu, @hunter.cuny.edu, or @myhunter.cuny.edu).' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const existing = await db.collection('students').findOne({ email: normalizedEmail });
    if (existing?.isVerified)
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const code = generateCode();
    const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (existing) {
      await db.collection('students').updateOne(
        { email: normalizedEmail },
        { $set: { name: name.trim(), passwordHash, verificationCode: code, verificationCodeExpiresAt } }
      );
    } else {
      await db.collection('students').insertOne({
        name: name.trim(), email: normalizedEmail, passwordHash,
        isVerified: false, verificationCode: code, verificationCodeExpiresAt,
        favorites: [], createdAt: new Date(),
      });
    }

    await sendVerificationEmail(normalizedEmail, code);
    return res.status(200).json({ message: 'Verification code sent.', email: normalizedEmail });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const student = await db.collection('students').findOne({ email: normalizedEmail });
    if (!student) return res.status(404).json({ error: 'No account found for this email.' });
    if (student.isVerified) return res.status(400).json({ error: 'Account already verified. Please log in.' });
    if (!student.verificationCode || !student.verificationCodeExpiresAt)
      return res.status(400).json({ error: 'No pending verification. Please request a new code.' });
    if (new Date() > student.verificationCodeExpiresAt)
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    if (student.verificationCode !== code.trim())
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    await db.collection('students').updateOne(
      { email: normalizedEmail },
      { $set: { isVerified: true }, $unset: { verificationCode: '', verificationCodeExpiresAt: '' } }
    );

    const token = jwt.sign({ email: normalizedEmail, userId: student._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ student: { name: student.name, email: normalizedEmail }, token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/resend-code', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const student = await db.collection('students').findOne({ email: normalizedEmail });
    if (!student) return res.status(404).json({ error: 'No account found for this email.' });
    if (student.isVerified) return res.status(400).json({ error: 'Account already verified.' });

    const code = generateCode();
    const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.collection('students').updateOne(
      { email: normalizedEmail },
      { $set: { verificationCode: code, verificationCodeExpiresAt } }
    );

    await sendVerificationEmail(normalizedEmail, code);
    return res.status(200).json({ message: 'New verification code sent.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const normalizedEmail = email.toLowerCase().trim();
  if (!isValidCunyEmail(normalizedEmail))
    return res.status(400).json({ error: 'Email must be a Hunter/CUNY address.' });

  try {
    const student = await db.collection('students').findOne({ email: normalizedEmail });
    if (!student) return res.status(404).json({ error: 'No account found. Please sign up first.' });

    const passwordMatch = await bcrypt.compare(password, student.passwordHash);
    if (!passwordMatch) return res.status(401).json({ error: 'Incorrect password.' });

    if (!student.isVerified) {
      const code = generateCode();
      const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.collection('students').updateOne(
        { email: normalizedEmail },
        { $set: { verificationCode: code, verificationCodeExpiresAt } }
      );
      await sendVerificationEmail(normalizedEmail, code);
      return res.status(403).json({ error: 'Email not verified.', needsVerification: true, email: normalizedEmail });
    }

    const token = jwt.sign({ email: normalizedEmail, userId: student._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ student: { name: student.name, email: normalizedEmail }, token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/verify', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided.' });

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    if (!payload.email) return res.status(401).json({ error: 'Invalid token.' });

    let name = 'Hunter Student';
    if (db) {
      const student = await db.collection('students').findOne({ email: payload.email });
      if (student) name = student.name;
    }
    return res.status(200).json({ student: { name, email: payload.email } });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ── Favorites endpoints ───────────────────────────────────────────────────────

app.get('/api/favorites', requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    const student = await db.collection('students').findOne({ email: req.user.email });
    return res.json(student?.favorites || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites', requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId is required.' });
  try {
    await db.collection('students').updateOne(
      { email: req.user.email },
      { $addToSet: { favorites: roomId } }
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/favorites/:roomId', requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    await db.collection('students').updateOne(
      { email: req.user.email },
      { $pull: { favorites: req.params.roomId } }
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
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
  const trimmed = roomNumber.trim();
  // check if it starts with C (like C001 = C floor)
  if (/^C/i.test(trimmed)) return 'C';
  
  // otherwise extract floor from digits
  const m = trimmed.match(/\d+/);
  if (!m) return 1;
  const digits = m[0];
  if (digits.length <= 2) return parseInt(digits[0]) || 1;
  return parseInt(digits.slice(0, -2)) || 1;
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
  const seenTimes = new Set(); // tracks start times
  const seenCourses = new Set(); // tracks course names
  
  for (const s of schedule) {
    if (s.room !== room) continue;
    for (const b of s.timeBlocks) {
      if (b.days.includes(dayAbbrev) && b.endMinutes > timeMinutes) {
        const courseName = s.courseTopic || s.subjectCode;
        // skip if we've already seen this start time OR this course
        if (seenTimes.has(b.startMinutes) || seenCourses.has(courseName)) continue;
        
        seenTimes.add(b.startMinutes);
        seenCourses.add(courseName);
        
        upcoming.push({
          courseTopic: courseName,
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

// GET /api/rooms/available?building=West%20Building&day=Tuesday&time=14:30&floor=3
app.get('/api/rooms/available', (req, res) => {
  const { building, day, time, floor } = req.query;
  if (!day || !time) {
    return res.status(400).json({ error: 'day and time query params are required' });
  }

  const dayAbbrev = DAY_NAME_TO_ABBREV[day] ?? day;
  const [hStr, mStr] = time.split(':');
  const timeMinutes = parseInt(hStr) * 60 + parseInt(mStr || '0');
  const floorFilter = floor ? floor.toString().toUpperCase() : null; // Floor can be "C", "B", or "1", "2", etc.

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
    const roomFloor = getFloor(roomNumber);
    if (floorFilter !== null && roomFloor.toString().toUpperCase() !== floorFilter) continue; // Filter by floor if specified
    const { nextClass, availableFor } = computeAvailability(room, dayAbbrev, timeMinutes);
    results.push({
      id:           room,
      building:     bldg,
      roomNumber,
      floor:        roomFloor,
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
  const { day, time } = req.query;
  let dayAbbrev, timeMinutes;
  // specified day/time
  if (day && time) {
    dayAbbrev = DAY_NAME_TO_ABBREV[day] ?? day;
    const [hStr, mStr] = time.split(':');
    timeMinutes = parseInt(hStr) * 60 + parseInt(mStr || '0');
  } else {
    // default to current day/time
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayAbbrev = DAY_NAME_TO_ABBREV[dayNames[now.getDay()]] ?? 'Mo';
    timeMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const roomMap = new Map();
  for (const s of schedule) {
    if (!roomMap.has(s.room)) {
      const roomNumber = getRoomNumber(s.room);
      const { nextClass, availableFor } = computeAvailability(s.room, dayAbbrev, timeMinutes);
      roomMap.set(s.room, {
        id:          s.room,
        building:    s.building,
        roomNumber,
        floor:       getFloor(roomNumber),
        availableFor,
        nextClass,
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
