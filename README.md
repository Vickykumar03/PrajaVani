# 🚧 CivicAlert — Road & Infrastructure Issue Reporter

A full-stack civic platform where citizens report road potholes, electricity outages, water shortages, drainage problems, and more — directly to the municipality. Includes citizen work verification with green/red voting indicators.

---

## 🗂 Project Structure

```
pothole-reporter/
├── backend/                  # Node.js + Express + MongoDB API
│   ├── models/
│   │   ├── User.js           # User model (citizen / municipality)
│   │   └── Complaint.js      # Complaint model with geo + voting
│   ├── routes/
│   │   ├── auth.js           # Login / Register
│   │   ├── complaints.js     # File, view, upvote, vote-work
│   │   └── municipality.js   # Dashboard, status update, stats
│   ├── middleware/
│   │   └── auth.js           # JWT protect + role restriction
│   ├── server.js             # Express app entry point
│   ├── .env.example          # Environment variables template
│   └── package.json
│
└── frontend/                 # Vanilla HTML/CSS/JS
    ├── index.html            # Full SPA
    ├── style.css             # Industrial dark theme
    └── app.js                # All frontend logic
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)

---

### 1. Backend Setup

```bash
cd backend
npm install

# Copy env file and configure
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start development server
npm run dev

# Or production
npm start
```

**The API runs at:** `http://localhost:5000`

---

### 2. Frontend Setup

The frontend is plain HTML/CSS/JS — no build step needed.

```bash
# Option A: Open directly in browser
open frontend/index.html

# Option B: Use VS Code Live Server (recommended)
# Install "Live Server" extension, right-click index.html → Open with Live Server

# Option C: Simple HTTP server
cd frontend
npx serve .
# or
python3 -m http.server 3000
```

> **Note:** Make sure the backend is running before opening the frontend.

---

### 3. Environment Variables

Create `backend/.env` from `.env.example`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pothole_reporter
JWT_SECRET=your_super_secret_jwt_key_here
NODE_ENV=development
```

For **MongoDB Atlas**, replace MONGODB_URI with your connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pothole_reporter
```

---

## 🔑 Features

### 👤 Citizen Board
- **File Reports** with GPS location auto-detection (uses browser Geolocation API + OpenStreetMap reverse geocoding)
- **Categories**: Pothole 🕳, Road Damage 🛣, Electricity ⚡, Water 💧, Drainage 🌊, Streetlight 💡, Garbage 🗑, Other
- **Severity levels**: Low / Medium / High / Critical
- **Upload photo evidence** (up to 3 images, stored as base64)
- **Upvote** complaints to raise priority
- **Work Verification Voting** on resolved complaints:
  - ✅ Green indicator = majority says work is done
  - ❌ Red indicator = majority says work is NOT done
- **Filters**: Recent | Earlier | Longest Pending + Category + Status

### 🏛 Municipality Dashboard (restricted access)
- Full complaint management with **status updates**: Pending → In Progress → Resolved → Rejected
- **Add notes** to each complaint
- **Stats bar**: Total, Pending, In Progress, Resolved, Verified Done, Not Done
- **Advanced filters**: Sort + Category + Status + Severity
- See reporter contact details (name, ward, email)

### 🔐 Auth
- JWT-based authentication (7-day tokens)
- Role-based access: `citizen` and `municipality`
- Register with name, email, phone, ward, role

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Complaints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/complaints` | List all complaints (filterable) |
| GET | `/api/complaints/:id` | Get single complaint |
| POST | `/api/complaints` | File new complaint (auth) |
| POST | `/api/complaints/:id/upvote` | Upvote (auth) |
| POST | `/api/complaints/:id/vote-work` | Vote work done/not done (citizen) |
| GET | `/api/complaints/my/list` | My complaints (auth) |

### Municipality (restricted)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/municipality/dashboard` | All complaints with stats |
| PATCH | `/api/municipality/:id/status` | Update status + notes |
| GET | `/api/municipality/stats` | Aggregate statistics |

---

## 🗺 Location Features
- **Browser Geolocation API** for precise GPS coordinates
- **OpenStreetMap Nominatim** for automatic reverse geocoding (address from coordinates)
- Coordinates stored as GeoJSON Point in MongoDB (supports geospatial queries)
- Direct **Google Maps link** in each complaint detail view

---

## 🎨 Design
- Dark industrial theme with **Bebas Neue** display font
- Color-coded severity indicators (left border stripe)
- Green/Red work verification status with glowing dot indicators
- Responsive grid layout
- Animated skeleton loading states

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose ODM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Geolocation | Browser API + OpenStreetMap Nominatim |
| Maps | Google Maps (link out) |

---

## 🧪 Test Accounts (create via registration)

To test municipality features, register with role = `municipality`.

```
# Citizen
email: citizen@test.com
password: test123
role: citizen

# Municipality
email: municipal@test.com  
password: test123
role: municipality
```
