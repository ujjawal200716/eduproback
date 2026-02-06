import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config(); // Load .env file

const app = express();

// --- 1. CONFIGURATION & CORS ---
// ✅ FIX: Explicitly allow your Vercel frontend and Localhost
app.use(cors({
  origin: [
    "http://localhost:5173",             // Local development
    "https://eback-ujjawal200716s-projects.vercel.app"       // Your Vercel Frontend
  ],
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true                      // Required for auth headers
}));

app.use(express.json());

// ⚡ AUTH SETTINGS
// Control this via your .env file (set BYPASS_AUTH=true to skip checks)
const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';

// ⚠️ KEYS (Loaded from Environment Variables)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY; 
const MONGO_URI = process.env.MONGO_URI;

// Check if keys are loaded
if (!SUPABASE_URL || !SUPABASE_KEY || !MONGO_URI) {
  console.error("❌ CRITICAL ERROR: Missing environment variables. Check your .env file or host settings.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. CONNECT TO MONGODB ---
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- 3. SCHEMAS ---
const NoteSchema = new mongoose.Schema({
  email: { type: String, required: true },
  title: String,
  smart_notes: String,
  mcq_json: Array,
  pages: Number,
  createdAt: { type: Date, default: Date.now }
});

const CareerSchema = new mongoose.Schema({
  email: { type: String, required: true },
  role: String,
  report_html: String,
  createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', NoteSchema);
const CareerReport = mongoose.model('CareerReport', CareerSchema);

// --- 4. MIDDLEWARE: EXTRACT EMAIL ---
const requireAuth = async (req, res, next) => {
  // 1. BYPASS MODE
  if (BYPASS_AUTH) {
    console.log("⚠️ DEV MODE: Bypassing Supabase Auth");
    req.userEmail = "test@dev.com"; 
    return next();
  }

  // 2. NORMAL MODE
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // 5-second timeout safeguard
    const { data, error } = await Promise.race([
        supabase.auth.getUser(token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase Timeout')), 5000))
    ]);

    if (error || !data.user) {
      throw new Error('Invalid token');
    }

    req.userEmail = data.user.email;
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    res.status(401).json({ success: false, error: "Authentication failed." });
  }
};

// --- 5. ROUTES ---

// ✅ NEW: HEALTH CHECK ROUTE (Required for Render Keep-Alive)
// This fixes the "404 Not Found" error when waking up the server
app.get('/', (req, res) => {
  res.send('Backend is Active! 🚀');
});

// Notes Routes
app.post('/api/notes', requireAuth, async (req, res) => {
  try {
    const { title, smart_notes, mcq_json, pages } = req.body;
    const newNote = new Note({ 
      email: req.userEmail, 
      title, smart_notes, mcq_json, pages 
    });
    await newNote.save();
    res.json({ success: true, note: newNote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notes', requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({ email: req.userEmail }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Career Routes
app.post('/api/career', requireAuth, async (req, res) => {
  try {
    const { role, report_html } = req.body;
    const newReport = new CareerReport({ 
      email: req.userEmail, role, report_html 
    });
    await newReport.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/career', requireAuth, async (req, res) => {
  try {
    const reports = await CareerReport.find({ email: req.userEmail }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 6. START SERVER ---
// ✅ Dynamic Port for Hosting (Render assigns a port automatically)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} | Bypass Mode: ${BYPASS_AUTH}`));
