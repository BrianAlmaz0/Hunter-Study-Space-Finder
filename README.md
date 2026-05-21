# Hunter Study Space Finder

A web app that helps Hunter College students find available classrooms to study in between classes. It pulls real course schedule data from CUNY Global Search, calculates which rooms are free at any given time, and lets students report live occupancy to each other.

🔗 **Live:** [hunter-study-space-finder.vercel.app](https://hunter-study-space-finder.vercel.app)

---

## Features

- **Room availability** — search by building, day, and time using real CUNY schedule data
- **Occupancy reporting** — students can check in to a room and report how crowded it is in real time
- **Favorites** — save rooms you like, synced to your account
- **Upcoming schedule** — see what classes are booked in a room throughout the day
- **Hunter/CUNY authentication** — only `@hunter.cuny.edu`, `@login.cuny.edu`, and `@myhunter.cuny.edu` emails can register
- **Email verification** — 6-digit code sent on signup, JWT-based sessions after that

---

## Tech Stack

**Frontend**
- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Framer Motion

**Backend**
- Node.js + Express
- MongoDB Atlas
- JWT authentication
- Nodemailer (email verification)

**Scraper**
- Playwright (headless browser automation)
- Cheerio (HTML parsing)

---

## How It Works

1. A Playwright scraper navigates CUNY Global Search and collects course schedule data for Hunter College
2. The scraped data is normalized and stored in MongoDB (895+ course sections)
3. The backend calculates which rooms are free based on the current day and time
4. Students search for available rooms by building, floor, or time window
5. Students can check into a room and report occupancy — reports expire automatically via MongoDB TTL indexes

---

## Authentication

Only Hunter/CUNY email addresses are accepted at signup. After entering your email and password, a 6-digit verification code is sent to your inbox. Once verified, the session is managed with a JWT stored client-side. Passwords are hashed with bcrypt.

Allowed domains: `@hunter.cuny.edu`, `@login.cuny.edu`, `@myhunter.cuny.edu`

---

## Deployment

| Service  | Platform      |
|----------|---------------|
| Frontend | Vercel        |
| Backend  | Render        |
| Database | MongoDB Atlas |

---

## Setup

```bash
# Clone the repo
git clone https://github.com/BrianAlmaz0/Hunter-Study-Space-Finder.git
cd Hunter-Study-Space-Finder

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

**Run locally:**
```bash
# Terminal 1 — backend
cd backend
npm start

# Terminal 2 — frontend
cd frontend
npm run dev
```

---

## Environment Variables

**Backend** (`backend/.env`):
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/hunter-study-spaces
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=https://your-backend.onrender.com
```

> For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) — not your regular password.

---

## Future Ideas

- Indoor maps / navigation to help students physically find rooms
- IoT sensors for automatic occupancy detection
- Smarter crowd prediction based on historical reports

---

