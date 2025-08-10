const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = 3000;
const path = require('path');
const session = require('express-session');

app.use(cors());
app.use(bodyParser.json());
app.use(session({
    secret: 'octoblox_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Serve static files (HTML, CSS, JS, images) from the website root
app.use(express.static(path.join(__dirname, '..')));

// Simple JSON file database
const DB_FILE = './db.json';
function readDB() {
    if (!fs.existsSync(DB_FILE)) return { users: [], messages: [], items: [], applications: [] };
    let db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.applications) db.applications = [];
    return db;
}
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Registration
app.post('/api/register', (req, res) => {
    const { username, password, email, phone, youtube } = req.body;
    let db = readDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    db.users.push({ username, password, email, phone, youtube, banned: false, banReason: '', banExpiry: null });
    writeDB(db);
    req.session.user = { username };
    res.json({ success: true });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let db = readDB();
    let user = db.users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    // Check ban status
    if (user.banned) {
        // If ban expired, remove ban
        if (user.banExpiry && new Date(user.banExpiry) < new Date()) {
            user.banned = false;
            user.banReason = '';
            user.banExpiry = null;
            writeDB(db);
        } else {
            return res.json({ success: true, user, banned: true, banReason: user.banReason, banExpiry: user.banExpiry });
        }
    }
    req.session.user = { username: user.username };
    res.json({ success: true, user, banned: false });
});

// Send message
app.post('/api/message', (req, res) => {
    const { from, to, message } = req.body;
    let db = readDB();
    db.messages.push({ from, to, message, date: new Date() });
    writeDB(db);
    res.json({ success: true });
});

// Admin: Ban user
app.post('/api/ban', (req, res) => {
    const { username, reason, expiry } = req.body;
    let db = readDB();
    let user = db.users.find(u => u.username === username);
    if (user) {
        user.banned = true;
        user.banReason = reason || 'No reason provided';
        user.banExpiry = expiry || null;
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'User not found' });
});

// Admin: Add item
// Get current user profile
app.get('/api/profile', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    let db = readDB();
    let user = db.users.find(u => u.username === req.session.user.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ username: user.username, joined: '2025', bio: 'Welcome to Octoblox!' });
});
// Job Application: Submit
app.post('/api/apply', (req, res) => {
    const { username, email, phone, why, location, skills } = req.body;
    let db = readDB();
    db.applications.push({ username, email, phone, why, location, skills, status: 'pending' });
    writeDB(db);
    res.json({ success: true });
});

// Job Application: List (for moderator)
app.get('/api/applications', (req, res) => {
    let db = readDB();
    res.json({ applications: db.applications });
});

// Job Application: Accept
app.post('/api/application/accept', (req, res) => {
    const { username } = req.body;
    let db = readDB();
    let app = db.applications.find(a => a.username === username && a.status === 'pending');
    let user = db.users.find(u => u.username === username);
    if (app && user) {
        app.status = 'accepted';
        user.role = 'employee';
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Application or user not found' });
});

// Job Application: Decline
app.post('/api/application/decline', (req, res) => {
    const { username } = req.body;
    let db = readDB();
    let app = db.applications.find(a => a.username === username && a.status === 'pending');
    if (app) {
        app.status = 'declined';
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Application not found' });
});
// Admin: Unban user
app.post('/api/unban', (req, res) => {
    const { username } = req.body;
    let db = readDB();
    let user = db.users.find(u => u.username === username);
    if (user) {
        user.banned = false;
        user.banReason = '';
        user.banExpiry = null;
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'User not found' });
});
app.post('/api/item', (req, res) => {
    const { name, price } = req.body;
    let db = readDB();
    db.items.push({ name, price });
    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Octoblox server running on http://localhost:${PORT}`);
});
