require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Validate required environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!JWT_SECRET || !ADMIN_SECRET) {
    console.error('JWT_SECRET and ADMIN_SECRET environment variables are required');
    process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Multer configuration for media uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const mediaDir = path.join(__dirname, 'media');
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }
        cb(null, mediaDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(file.originalname);
        cb(null, `${timestamp}_${randomString}${extension}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Middleware
app.use('/media', express.static(path.join(__dirname, 'media')));
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));

// CORS with proper security
app.use((req, res, next) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    const origin = req.headers.origin;
    
    if (process.env.NODE_ENV === 'development') {
        res.header('Access-Control-Allow-Origin', '*');
    } else if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Logging with rotation
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const getLogFile = () => {
    const today = new Date().toISOString().split('T')[0];
    return path.join(logDir, `chat-${today}.log`);
};

let logStream = fs.createWriteStream(getLogFile(), { flags: 'a' });

// Rotate log daily
setInterval(() => {
    logStream.end();
    logStream = fs.createWriteStream(getLogFile(), { flags: 'a' });
}, 24 * 60 * 60 * 1000);

function logMessage(message) {
    const logEntry = `${new Date().toISOString()} - ${message}\n`;
    logStream.write(logEntry);
    console.log(logEntry.trim());
}

// Persistent storage
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Data structures
let usersDB = new Map();
let verificationCodes = new Map();
let resetCodes = new Map();
let emailToUserKey = new Map();
let userKeyToEmail = new Map();
let usernames = new Set();
let friendsDB = new Map();
let friendRequestsDB = new Map();
let hiddenChatsDB = new Map();
let messageHistory = new Map();
let groups = new Map();
let userGroups = new Map();
let blockedUsersDB = new Map();
let callSessions = new Map();

// Data saving mutex
let saving = false;

// Load data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            usersDB = new Map(Object.entries(data.usersDB || {}));
            emailToUserKey = new Map(Object.entries(data.emailToUserKey || {}));
            userKeyToEmail = new Map(Object.entries(data.userKeyToEmail || {}));
            usernames = new Set(data.usernames || []);
            friendsDB = new Map(Object.entries(data.friendsDB || {}).map(([k, v]) => [k, new Set(v)]));
            friendRequestsDB = new Map(Object.entries(data.friendRequestsDB || {}).map(([k, v]) => [k, new Set(v)]));
            hiddenChatsDB = new Map(Object.entries(data.hiddenChatsDB || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));
            groups = new Map(Object.entries(data.groups || {}).map(([k, v]) => [k, new Set(v)]));
            userGroups = new Map(Object.entries(data.userGroups || {}).map(([k, v]) => [k, new Set(v)]));
            blockedUsersDB = new Map(Object.entries(data.blockedUsersDB || {}).map(([k, v]) => [k, new Set(v)]));
            messageHistory = new Map(Object.entries(data.messageHistory || {}));
            logMessage('Data loaded successfully');
        }
        createAdminUser();
    } catch (error) {
        logMessage(`Error loading data: ${error.message}`);
        createAdminUser();
    }
}

// Save data with mutex
async function saveData() {
    if (saving) return;
    saving = true;
    
    try {
        const data = {
            usersDB: Object.fromEntries(usersDB),
            emailToUserKey: Object.fromEntries(emailToUserKey),
            userKeyToEmail: Object.fromEntries(userKeyToEmail),
            usernames: Array.from(usernames),
            friendsDB: Object.fromEntries(Array.from(friendsDB.entries()).map(([k, v]) => [k, Array.from(v)])),
            friendRequestsDB: Object.fromEntries(Array.from(friendRequestsDB.entries()).map(([k, v]) => [k, Array.from(v)])),
            hiddenChatsDB: Object.fromEntries(Array.from(hiddenChatsDB.entries()).map(([k, v]) => [k, Object.fromEntries(v)])),
            groups: Object.fromEntries(Array.from(groups.entries()).map(([k, v]) => [k, Array.from(v)])),
            userGroups: Object.fromEntries(Array.from(userGroups.entries()).map(([k, v]) => [k, Array.from(v)])),
            blockedUsersDB: Object.fromEntries(Array.from(blockedUsersDB.entries()).map(([k, v]) => [k, Array.from(v)])),
            messageHistory: Object.fromEntries(messageHistory)
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        logMessage('Data saved successfully');
    } catch (error) {
        logMessage(`Error saving data: ${error.message}`);
        throw error;
    } finally {
        saving = false;
    }
}

// Create admin user
function createAdminUser() {
    const adminExists = Array.from(usersDB.values()).some(user => user.isAdmin);
    if (!adminExists) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
        const adminUserKey = generateUserKey();
        const adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
        const { publicKey, privateKey } = generateRSAKeyPair();

        usersDB.set(adminUserKey, {
            email: adminEmail,
            passwordHash: adminPasswordHash,
            verified: true,
            username: 'admin',
            userKey: adminUserKey,
            isAdmin: true,
            publicKey,
            privateKey,
            createdAt: Date.now(),
            lastSeen: Date.now(),
            status: 'offline'
        });

        emailToUserKey.set(adminEmail, adminUserKey);
        userKeyToEmail.set(adminUserKey, adminEmail);
        usernames.add('admin');
        friendsDB.set(adminUserKey, new Set());
        friendRequestsDB.set(adminUserKey, new Set());
        hiddenChatsDB.set(adminUserKey, new Map());
        blockedUsersDB.set(adminUserKey, new Set());

        logMessage(`Created admin user: ${adminEmail}, password: ${adminPassword}`);
        console.log(`\n🔐 ADMIN CREDENTIALS (SAVE THESE!):`);
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log(`UserKey: ${adminUserKey}\n`);

        saveData();
    }
}

// RSA key pair
function generateRSAKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
}

// Generate user key
function generateUserKey() {
    let key;
    do {
        key = crypto.randomBytes(4).toString('hex').toUpperCase();
    } while (userKeyToEmail.has(key));
    return key;
}

// Email setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// WebSocket connections and rate limiting
const users = new Map();
const rateLimits = new Map();

const RATE_LIMIT = 100;
const RATE_WINDOW = 60000;

function checkRateLimit(userKey) {
    const now = Date.now();
    const userLimit = rateLimits.get(userKey) || { count: 0, resetTime: now };
    if (now > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + RATE_WINDOW;
    }
    userLimit.count++;
    rateLimits.set(userKey, userLimit);
    return userLimit.count <= RATE_LIMIT;
}

// Clean up rate limits periodically
setInterval(() => {
    const now = Date.now();
    for (const [userKey, limit] of rateLimits.entries()) {
        if (now > limit.resetTime) {
            rateLimits.delete(userKey);
        }
    }
}, 300000); // Clean every 5 minutes

// Clean up expired verification codes
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
        if (data.expires && now > data.expires) {
            verificationCodes.delete(email);
        }
    }
    for (const [email, data] of resetCodes.entries()) {
        if (data.expires && now > data.expires) {
            resetCodes.delete(email);
        }
    }
}, 300000); // Clean every 5 minutes

// Message validation
function validateMessage(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.type || typeof data.type !== 'string') return false;
    if (data.content && data.content.length > 100000) return false;
    return true;
}

// Generate verification code with expiry
function generateVerificationCode() {
    return {
        code: Math.floor(100000 + Math.random() * 900000).toString(),
        expires: Date.now() + 600000 // 10 minutes
    };
}

// Initialize
loadData();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        users: usersDB.size,
        onlineUsers: users.size,
        groups: groups.size,
        timestamp: new Date().toISOString()
    });
});

// Test user existence
app.get('/test-user', (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.json({ success: false, message: 'Email required' });
    }
    const userKey = emailToUserKey.get(email);
    const user = usersDB.get(userKey);
    res.json({
        success: true,
        exists: !!user,
        verified: user ? user.verified : false,
        userKey: userKey || null,
        username: user ? user.username : null
    });
});

// Register
app.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        if (!email || !password || !username) {
            return res.json({ success: false, message: 'Email, password, and username are required' });
        }
        if (emailToUserKey.has(email)) {
            return res.json({ success: false, message: 'Email already registered' });
        }
        if (usernames.has(username)) {
            return res.json({ success: false, message: 'Username already taken' });
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.json({ success: false, message: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
        }
        if (password.length < 6) {
            return res.json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const userKey = generateUserKey();
        const { publicKey, privateKey } = generateRSAKeyPair();

        const userData = {
            email,
            passwordHash,
            verified: false,
            username,
            userKey,
            isAdmin: false,
            publicKey,
            privateKey,
            createdAt: Date.now(),
            lastSeen: Date.now(),
            status: 'offline'
        };

        usersDB.set(userKey, userData);
        emailToUserKey.set(email, userKey);
        userKeyToEmail.set(userKey, email);
        usernames.add(username);
        friendsDB.set(userKey, new Set());
        friendRequestsDB.set(userKey, new Set());
        hiddenChatsDB.set(userKey, new Map());
        blockedUsersDB.set(userKey, new Set());

        const verification = generateVerificationCode();
        verificationCodes.set(email, verification);

        await saveData();

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Verify Your Email - Secure Chat',
                html: `
                    <h2>Welcome to Secure Chat!</h2>
                    <p>Your verification code is: <strong>${verification.code}</strong></p>
                    <p>Your User Key is: <strong>${userKey}</strong></p>
                    <p>Please save your User Key as others will need it to add you as a friend.</p>
                    <p>This code will expire in 10 minutes.</p>
                `
            });
            logMessage(`Verification email sent to ${email}`);
        } else {
            logMessage(`Email not sent to ${email}: EMAIL_USER or EMAIL_PASS missing`);
        }

        res.json({
            success: true,
            userKey,
            message: 'Registration successful. Please check your email for verification code.'
        });
    } catch (error) {
        logMessage(`Registration error: ${error.message}`);
        res.json({ success: false, message: 'Registration failed' });
    }
});

// Verify
app.post('/verify', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.json({ success: false, message: 'Email and code are required' });
        }
        
        const verification = verificationCodes.get(email);
        if (!verification || Date.now() > verification.expires || verification.code !== code) {
            return res.json({ success: false, message: 'Invalid or expired verification code' });
        }
        
        const userKey = emailToUserKey.get(email);
        const user = usersDB.get(userKey);
        if (user) {
            user.verified = true;
            usersDB.set(userKey, user);
            verificationCodes.delete(email);
            
            const token = jwt.sign({
                userKey: userKey,
                email: user.email,
                username: user.username,
                isAdmin: user.isAdmin
            }, JWT_SECRET, { expiresIn: '24h' });
            
            await saveData();
            res.json({
                success: true,
                token: token,
                userKey: userKey,
                username: user.username,
                isAdmin: user.isAdmin
            });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        logMessage(`Verification error: ${error.message}`);
        res.json({ success: false, message: 'Verification failed' });
    }
});

// Login - FIXED SYNTAX ERROR
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            logMessage('Login failed: Missing email or password');
            return res.json({ success: false, message: 'Email and password required' });
        }
        
        const userKey = emailToUserKey.get(email);
        if (!userKey) {
            logMessage(`Login failed: No userKey for email ${email}`);
            return res.json({ success: false, message: 'User not found' });
        }
        
        const user = usersDB.get(userKey);
        if (!user) {
            logMessage(`Login failed: No user found for userKey ${userKey}`);
            return res.json({ success: false, message: 'User not found' });
        }
        
        if (!user.verified) {
            logMessage(`Login failed: User ${email} not verified`);
            return res.json({ success: false, message: 'Please verify your email first' });
        }
        
        const match = await bcrypt.compare(password, user.passwordHash);
        if (match) {
            const token = jwt.sign({
                userKey: userKey,
                email: email,
                username: user.username,
                isAdmin: user.isAdmin
            }, JWT_SECRET, { expiresIn: '24h' });
            
            user.lastSeen = Date.now();
            usersDB.set(userKey, user);
            await saveData();
            
            logMessage(`Login successful for ${email} (userKey: ${userKey})`);
            res.json({
                success: true,
                token: token,
                userKey: userKey,
                username: user.username,
                isAdmin: user.isAdmin
            });
        } else {
            logMessage(`Login failed: Invalid password for ${email}`);
            return res.json({ success: false, message: 'Invalid password' });
        }
    } catch (error) {
        logMessage(`Login error: ${error.message}`);
        res.json({ success: false, message: 'Login failed' });
    }
});

// Forgot Password
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.json({ success: false, message: 'Email required' });
        }
        
        const userKey = emailToUserKey.get(email);
        if (!userKey || !usersDB.has(userKey)) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        const resetData = generateVerificationCode();
        resetCodes.set(email, resetData);
        
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Password Reset - Secure Chat',
                html: `
                    <p>Your password reset code is: <strong>${resetData.code}</strong></p>
                    <p>This code will expire in 10 minutes.</p>
                `
            });
            logMessage(`Password reset email sent to ${email}`);
        } else {
            logMessage(`Email not sent to ${email}: EMAIL_USER or EMAIL_PASS missing`);
        }
        
        res.json({ success: true, message: 'Reset code sent to your email' });
    } catch (error) {
        logMessage(`Forgot password error: ${error.message}`);
        res.json({ success: false, message: 'Failed to send reset code' });
    }
});

// Reset Password
app.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            return res.json({ success: false, message: 'Email, code, and new password required' });
        }
        
        const resetData = resetCodes.get(email);
        if (!resetData || Date.now() > resetData.expires || resetData.code !== code) {
            return res.json({ success: false, message: 'Invalid or expired reset code' });
        }
        
        const userKey = emailToUserKey.get(email);
        const user = usersDB.get(userKey);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        user.passwordHash = await bcrypt.hash(newPassword, 12);
        usersDB.set(userKey, user);
        resetCodes.delete(email);
        await saveData();
        
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        logMessage(`Reset password error: ${error.message}`);
        res.json({ success: false, message: 'Password reset failed' });
    }
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token required' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Middleware to check admin
function requireAdmin(req, res, next) {
    if (!req.user.isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

// Profile
app.get('/profile', authenticateToken, (req, res) => {
    const user = usersDB.get(req.user.userKey);
    if (!user) {
        return res.json({ success: false, message: 'User not found' });
    }
    res.json({
        success: true,
        user: {
            email: user.email,
            username: user.username,
            userKey: user.userKey,
            isAdmin: user.isAdmin
        }
    });
});

// Update Profile
app.post('/update-profile', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.json({ success: false, message: 'Invalid username' });
        }
        
        const user = usersDB.get(req.user.userKey);
        if (usernames.has(username) && username !== user.username) {
            return res.json({ success: false, message: 'Username already taken' });
        }
        
        usernames.delete(user.username);
        user.username = username;
        usernames.add(username);
        usersDB.set(req.user.userKey, user);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Update profile error: ${error.message}`);
        res.json({ success: false, message: 'Profile update failed' });
    }
});

// Change Password
app.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.json({ success: false, message: 'Current and new passwords required' });
        }
        
        const user = usersDB.get(req.user.userKey);
        const match = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!match) {
            return res.json({ success: false, message: 'Current password incorrect' });
        }
        
        user.passwordHash = await bcrypt.hash(newPassword, 12);
        usersDB.set(req.user.userKey, user);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Change password error: ${error.message}`);
        res.json({ success: false, message: 'Password change failed' });
    }
});

// Search Users by User Key - IMPROVED
app.get('/search-users', authenticateToken, (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 2) {
        return res.json({ success: true, users: [] });
    }
    
    const results = Array.from(usersDB.entries())
        .filter(([userKey, user]) => 
            userKey.includes(query.toUpperCase()) && 
            userKey !== req.user.userKey
        )
        .slice(0, 20) // Limit results
        .map(([userKey, user]) => ({
            userKey,
            username: user.username,
            status: user.status
        }));
    
    res.json({ success: true, users: results });
});

// Friends
app.get('/friends', authenticateToken, (req, res) => {
    const friends = Array.from(friendsDB.get(req.user.userKey) || [])
        .map(friendKey => {
            const user = usersDB.get(friendKey);
            return user ? { userKey: friendKey, username: user.username, status: user.status } : null;
        })
        .filter(Boolean);
    
    const pendingRequests = Array.from(friendRequestsDB.entries())
        .flatMap(([requestId, request]) =>
            request.has(req.user.userKey) ? [{
                id: requestId,
                fromUserKey: requestId.split(':')[0],
                fromUsername: usersDB.get(requestId.split(':')[0])?.username || 'Unknown'
            }] : []
        );
    
    res.json({ success: true, friends, pendingRequests });
});

// Send Friend Request - IMPROVED
app.post('/send-friend-request', authenticateToken, async (req, res) => {
    try {
        const { targetUserKey } = req.body;
        if (!targetUserKey || !usersDB.has(targetUserKey)) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (targetUserKey === req.user.userKey) {
            return res.json({ success: false, message: 'Cannot add yourself' });
        }
        if ((friendsDB.get(req.user.userKey) || new Set()).has(targetUserKey)) {
            return res.json({ success: false, message: 'Already friends' });
        }
        if ((blockedUsersDB.get(req.user.userKey) || new Set()).has(targetUserKey)) {
            return res.json({ success: false, message: 'User is blocked' });
        }
        
        const requestId = `${req.user.userKey}:${targetUserKey}`;
        const reverseRequestId = `${targetUserKey}:${req.user.userKey}`;
        
        if (friendRequestsDB.has(requestId)) {
            return res.json({ success: false, message: 'Request already sent' });
        }
        
        if (friendRequestsDB.has(reverseRequestId)) {
            return res.json({ success: false, message: 'This user has already sent you a request' });
        }
        
        friendRequestsDB.set(requestId, new Set([req.user.userKey, targetUserKey]));
        await saveData();
        
        const targetWs = users.get(targetUserKey);
        if (targetWs) {
            targetWs.send(JSON.stringify({
                type: 'friend_request',
                from: req.user.userKey,
                fromUsername: req.user.username
            }));
        }
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Send friend request error: ${error.message}`);
        res.json({ success: false, message: 'Failed to send friend request' });
    }
});

app.post('/respond-friend-request', authenticateToken, async (req, res) => {
    try {
        const { requestId, action } = req.body;
        if (!requestId || !friendRequestsDB.has(requestId)) {
            return res.json({ success: false, message: 'Request not found' });
        }
        
        const [fromUserKey, toUserKey] = requestId.split(':');
        if (toUserKey !== req.user.userKey) {
            return res.json({ success: false, message: 'Unauthorized' });
        }
        
        if (action === 'accept') {
            if (!friendsDB.has(fromUserKey)) friendsDB.set(fromUserKey, new Set());
            if (!friendsDB.has(toUserKey)) friendsDB.set(toUserKey, new Set());
            friendsDB.get(fromUserKey).add(toUserKey);
            friendsDB.get(toUserKey).add(fromUserKey);
            
            const fromWs = users.get(fromUserKey);
            const toWs = users.get(toUserKey);
            
            if (fromWs) {
                fromWs.send(JSON.stringify({ type: 'friend_added', userKey: toUserKey }));
            }
            if (toWs) {
                toWs.send(JSON.stringify({ type: 'friend_added', userKey: fromUserKey }));
            }
        }
        
        friendRequestsDB.delete(requestId);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Respond friend request error: ${error.message}`);
        res.json({ success: false, message: 'Failed to respond to friend request' });
    }
});

app.post('/remove-friend', authenticateToken, async (req, res) => {
    try {
        const { friendUserKey } = req.body;
        if (!friendUserKey || !(friendsDB.get(req.user.userKey) || new Set()).has(friendUserKey)) {
            return res.json({ success: false, message: 'Friend not found' });
        }
        
        friendsDB.get(req.user.userKey).delete(friendUserKey);
        friendsDB.get(friendUserKey)?.delete(req.user.userKey);
        await saveData();
        
        const friendWs = users.get(friendUserKey);
        if (friendWs) {
            friendWs.send(JSON.stringify({ type: 'friend_removed', userKey: req.user.userKey }));
        }
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Remove friend error: ${error.message}`);
        res.json({ success: false, message: 'Failed to remove friend' });
    }
});

// Block/Unblock User
app.post('/block-user', authenticateToken, async (req, res) => {
    try {
        const { targetUserKey, action } = req.body;
        if (!targetUserKey || !usersDB.has(targetUserKey)) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (targetUserKey === req.user.userKey) {
            return res.json({ success: false, message: 'Cannot block yourself' });
        }
        
        const blocked = blockedUsersDB.get(req.user.userKey) || new Set();
        if (action === 'block') {
            blocked.add(targetUserKey);
            if (!friendsDB.has(req.user.userKey)) friendsDB.set(req.user.userKey, new Set());
            if (!friendsDB.has(targetUserKey)) friendsDB.set(targetUserKey, new Set());
            friendsDB.get(req.user.userKey).delete(targetUserKey);
            friendsDB.get(targetUserKey).delete(req.user.userKey);
        } else if (action === 'unblock') {
            blocked.delete(targetUserKey);
        } else {
            return res.json({ success: false, message: 'Invalid action' });
        }
        
        blockedUsersDB.set(req.user.userKey, blocked);
        await saveData();
        res.json({ success: true });
    } catch (error) {
        logMessage(`Block user error: ${error.message}`);
        res.json({ success: false, message: 'Failed to block/unblock user' });
    }
});

app.get('/blocked-users', authenticateToken, (req, res) => {
    const blocked = Array.from(blockedUsersDB.get(req.user.userKey) || [])
        .map(userKey => {
            const user = usersDB.get(userKey);
            return user ? { userKey, username: user.username } : null;
        })
        .filter(Boolean);
    
    res.json({ success: true, blockedUsers: blocked });
});

// Hidden Chats
app.get('/hidden-chats', authenticateToken, (req, res) => {
    const hiddenChats = Array.from((hiddenChatsDB.get(req.user.userKey) || new Map()).entries())
        .map(([chatId, { chatType, isLocked }]) => ({ chatId, chatType, isLocked }));
    
    res.json({ success: true, hiddenChats });
});

app.post('/set-hidden-chat', authenticateToken, async (req, res) => {
    try {
        const { chatId, password, isHidden, chatType } = req.body;
        if (!chatId || !password || !chatType) {
            return res.json({ success: false, message: 'Chat ID, password, and type required' });
        }
        
        if (chatType === 'direct' && !usersDB.has(chatId)) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (chatType === 'group' && !groups.has(chatId)) {
            return res.json({ success: false, message: 'Group not found' });
        }
        
        const userHiddenChats = hiddenChatsDB.get(req.user.userKey) || new Map();
        if (isHidden) {
            const passwordHash = await bcrypt.hash(password, 12);
            userHiddenChats.set(chatId, { passwordHash, chatType, isLocked: true });
        } else {
            userHiddenChats.delete(chatId);
        }
        
        hiddenChatsDB.set(req.user.userKey, userHiddenChats);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Set hidden chat error: ${error.message}`);
        res.json({ success: false, message: 'Failed to set hidden chat' });
    }
});

app.post('/verify-chat-password', authenticateToken, async (req, res) => {
    try {
        const { chatId, password } = req.body;
        if (!chatId || !password) {
            return res.json({ success: false, message: 'Chat ID and password required' });
        }
        
        const userHiddenChats = hiddenChatsDB.get(req.user.userKey) || new Map();
        const chat = userHiddenChats.get(chatId);
        if (!chat) {
            return res.json({ success: false, message: 'Chat not hidden' });
        }
        
        const match = await bcrypt.compare(password, chat.passwordHash);
        if (match) {
            chat.isLocked = false;
            userHiddenChats.set(chatId, chat);
            hiddenChatsDB.set(req.user.userKey, userHiddenChats);
            await saveData();
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Invalid password' });
        }
    } catch (error) {
        logMessage(`Verify chat password error: ${error.message}`);
        res.json({ success: false, message: 'Password verification failed' });
    }
});

// Chat History - IMPROVED WITH PAGINATION + group support
app.get('/chat-history/:chatId', authenticateToken, (req, res) => {
    const { chatId } = req.params;
    const { limit = 50, offset = 0, chatType = 'direct' } = req.query;
    
    const userHiddenChats = hiddenChatsDB.get(req.user.userKey) || new Map();
    if (userHiddenChats.has(chatId) && userHiddenChats.get(chatId).isLocked) {
        return res.json({ success: false, message: 'Chat is locked' });
    }

    // Determine chat key based on type
    let chatKey;
    if (chatType === 'group') {
        if (!groups.has(chatId) || !(userGroups.get(req.user.userKey) || new Set()).has(chatId)) {
            return res.json({ success: false, message: 'Not a group member or group not found' });
        }
        chatKey = chatId;
    } else {
        chatKey = [req.user.userKey, chatId].sort().join(':');
    }
    
    const allMessages = messageHistory.get(chatKey) || [];
    const totalMessages = allMessages.length;
    
    const messages = allMessages
        .slice(-Number(limit) - Number(offset), -Number(offset) || undefined)
        .map(msg => ({
            id: msg.id,
            from: msg.from,
            to: msg.to,
            groupId: msg.groupId,
            content: msg.content,
            fromUsername: usersDB.get(msg.from)?.username || 'Unknown',
            isMedia: msg.isMedia,
            mimeType: msg.mimeType,
            timestamp: msg.timestamp
        }));
    
    res.json({ 
        success: true, 
        messages,
        totalMessages,
        hasMore: totalMessages > Number(limit) + Number(offset)
    });
});

// Media Upload - IMPROVED
app.post('/upload-media', authenticateToken, upload.single('media'), async (req, res) => {
    try {
        const { chatId, chatType } = req.body;
        if (!req.file || !chatId || !chatType) {
            return res.json({ success: false, message: 'File, chat ID, and type required' });
        }
        
        if (chatType === 'direct' && !usersDB.has(chatId)) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (chatType === 'group' && !groups.has(chatId)) {
            return res.json({ success: false, message: 'Group not found' });
        }
        if ((blockedUsersDB.get(chatId) || new Set()).has(req.user.userKey)) {
            return res.json({ success: false, message: 'You are blocked by this user' });
        }
        
        const chatKey = chatType === 'direct' ? [req.user.userKey, chatId].sort().join(':') : chatId;
        const message = {
            id: uuidv4(),
            from: req.user.userKey,
            [chatType === 'group' ? 'groupId' : 'to']: chatId,
            content: `/media/${req.file.filename}`,
            isMedia: true,
            mimeType: req.file.mimetype,
            timestamp: Date.now()
        };
        
        if (!messageHistory.has(chatKey)) {
            messageHistory.set(chatKey, []);
        }
        messageHistory.get(chatKey).push(message);
        await saveData();
        
        if (chatType === 'direct') {
            const recipientWs = users.get(chatId);
            if (recipientWs) {
                recipientWs.send(JSON.stringify({ 
                    type: 'message', 
                    ...message, 
                    fromUsername: req.user.username 
                }));
            }
        } else {
            groups.get(chatId).forEach(memberKey => {
                if (memberKey !== req.user.userKey) {
                    const memberWs = users.get(memberKey);
                    if (memberWs) {
                        memberWs.send(JSON.stringify({ 
                            type: 'message', 
                            ...message, 
                            fromUsername: req.user.username 
                        }));
                    }
                }
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Media upload error: ${error.message}`);
        res.json({ success: false, message: 'Media upload failed' });
    }
});

// Delete Message - IMPROVED WITH FILE CLEANUP
app.delete('/message/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { chatId, chatType = 'direct' } = req.query;
        if (!chatId) {
            return res.json({ success: false, message: 'Chat ID required' });
        }
        
        const chatKey = chatType === 'group' ? chatId : [req.user.userKey, chatId].sort().join(':');
        const messages = messageHistory.get(chatKey) || [];
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex === -1) {
            return res.json({ success: false, message: 'Message not found' });
        }
        
        const message = messages[messageIndex];
        if (message.from !== req.user.userKey) {
            return res.json({ success: false, message: 'Unauthorized' });
        }
        
        // Clean up media file if it exists
        if (message.isMedia) {
            const contentPath = message.content.startsWith('/media/') ? message.content.slice(1) : message.content;
            const filePath = path.join(__dirname, contentPath);
            fs.unlink(filePath, (err) => {
                if (err) logMessage(`Failed to delete file: ${err.message}`);
                else logMessage(`Deleted file: ${filePath}`);
            });
        }
        
        messages.splice(messageIndex, 1);
        messageHistory.set(chatKey, messages);
        await saveData();
        
        if (chatType === 'direct') {
            const recipientWs = users.get(chatId);
            if (recipientWs) {
                recipientWs.send(JSON.stringify({ type: 'message_deleted', messageId }));
            }
        } else if (chatType === 'group') {
            groups.get(chatId)?.forEach(memberKey => {
                if (memberKey !== req.user.userKey) {
                    users.get(memberKey)?.send(JSON.stringify({ type: 'message_deleted', messageId }));
                }
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Delete message error: ${error.message}`);
        res.json({ success: false, message: 'Failed to delete message' });
    }
});

// Groups
app.get('/groups', authenticateToken, (req, res) => {
    const userGroupsList = Array.from(userGroups.get(req.user.userKey) || [])
        .map(groupId => ({
            groupId,
            memberCount: groups.get(groupId)?.size || 0
        }));
    
    res.json({ success: true, groups: userGroupsList });
});

app.post('/create-group', authenticateToken, async (req, res) => {
    try {
        const { groupName, memberKeys } = req.body;
        if (!groupName || !Array.isArray(memberKeys) || memberKeys.length < 1) {
            return res.json({ success: false, message: 'Group name and at least one member required' });
        }
        
        for (const key of memberKeys) {
            if (!usersDB.has(key)) {
                return res.json({ success: false, message: `User ${key} not found` });
            }
        }
        
        const groupId = uuidv4();
        const members = new Set([...memberKeys, req.user.userKey]);
        groups.set(groupId, members);
        
        members.forEach(memberKey => {
            if (!userGroups.has(memberKey)) {
                userGroups.set(memberKey, new Set());
            }
            userGroups.get(memberKey).add(groupId);
            
            const memberWs = users.get(memberKey);
            if (memberWs) {
                memberWs.send(JSON.stringify({ type: 'group_created', groupId }));
            }
        });
        
        await saveData();
        res.json({ success: true, groupId });
    } catch (error) {
        logMessage(`Create group error: ${error.message}`);
        res.json({ success: false, message: 'Failed to create group' });
    }
});

app.post('/leave-group', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.body;
        if (!groupId || !groups.has(groupId)) {
            return res.json({ success: false, message: 'Group not found' });
        }
        
        const members = groups.get(groupId);
        if (!members.has(req.user.userKey)) {
            return res.json({ success: false, message: 'Not a group member' });
        }
        
        members.delete(req.user.userKey);
        userGroups.get(req.user.userKey)?.delete(groupId);
        
        if (members.size === 0) {
            groups.delete(groupId);
        }
        
        await saveData();
        
        members.forEach(memberKey => {
            const memberWs = users.get(memberKey);
            if (memberWs) {
                memberWs.send(JSON.stringify({ 
                    type: 'user_left_group', 
                    groupId, 
                    userKey: req.user.userKey 
                }));
            }
        });
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Leave group error: ${error.message}`);
        res.json({ success: false, message: 'Failed to leave group' });
    }
});

// Admin Routes
app.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const usersList = Array.from(usersDB.entries()).map(([userKey, user]) => ({
        userKey,
        username: user.username,
        email: user.email,
        status: user.status,
        verified: user.verified,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen
    }));
    
    res.json({ success: true, users: usersList });
});

app.post('/admin/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { targetUserKey, newPassword } = req.body;
        if (!targetUserKey || !newPassword) {
            return res.json({ success: false, message: 'User key and new password required' });
        }
        
        const user = usersDB.get(targetUserKey);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        user.passwordHash = await bcrypt.hash(newPassword, 12);
        usersDB.set(targetUserKey, user);
        await saveData();
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Admin reset password error: ${error.message}`);
        res.json({ success: false, message: 'Password reset failed' });
    }
});

// Admin Delete User - FIXED
app.delete('/admin/user/:userKey', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userKey } = req.params;
        const user = usersDB.get(userKey);
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        if (user.isAdmin) {
            return res.json({ success: false, message: 'Cannot delete admin user' });
        }
        
        const email = userKeyToEmail.get(userKey);
        const username = user.username;
        
        // Remove all user data
        usersDB.delete(userKey);
        userKeyToEmail.delete(userKey);
        emailToUserKey.delete(email);
        usernames.delete(username);
        friendsDB.delete(userKey);
        // Remove friend requests involving this user
        Array.from(friendRequestsDB.keys()).forEach(id => {
            if (id.startsWith(userKey + ':') || id.endsWith(':' + userKey)) {
                friendRequestsDB.delete(id);
            }
        });
        hiddenChatsDB.delete(userKey);
        blockedUsersDB.delete(userKey);
        
        // Remove user from all groups
        userGroups.get(userKey)?.forEach(groupId => {
            groups.get(groupId)?.delete(userKey);
            if ((groups.get(groupId)?.size || 0) === 0) {
                groups.delete(groupId);
            }
        });
        userGroups.delete(userKey);
        
        await saveData();
        
        // Close user's WebSocket connection
        const userWs = users.get(userKey);
        if (userWs) {
            userWs.close();
        }
        
        res.json({ success: true });
    } catch (error) {
        logMessage(`Admin delete user error: ${error.message}`);
        res.json({ success: false, message: 'User deletion failed' });
    }
});

app.get('/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    res.json({
        success: true,
        stats: {
            totalUsers: usersDB.size,
            onlineUsers: users.size,
            totalGroups: groups.size,
            totalMessages: Array.from(messageHistory.values()).reduce((sum, msgs) => sum + msgs.length, 0),
            verifiedUsers: Array.from(usersDB.values()).filter(user => user.verified).length,
            totalFriendships: Array.from(friendsDB.values()).reduce((sum, friends) => sum + friends.size, 0) / 2
        }
    });
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let userKey = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (!validateMessage(data)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
                return;
            }
            
            if (!userKey && data.type !== 'auth') {
                ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
                return;
            }
            
            if (!checkRateLimit(userKey || 'anonymous')) {
                ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
                return;
            }

            switch (data.type) {
                case 'auth':
                    try {
                        const decoded = jwt.verify(data.token, JWT_SECRET);
                        userKey = decoded.userKey;
                        const user = usersDB.get(userKey);
                        
                        if (!user) {
                            ws.send(JSON.stringify({ type: 'error', message: 'User not found' }));
                            ws.close();
                            return;
                        }
                        
                        users.set(userKey, ws);
                        user.status = 'online';
                        user.lastSeen = Date.now();
                        usersDB.set(userKey, user);
                        await saveData();
                        
                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            userKey,
                            isAdmin: user.isAdmin
                        }));
                        
                        broadcastStatus(userKey, 'online');
                    } catch (error) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                        ws.close();
                    }
                    break;

                case 'message':
                    if (!data.content || (!data.to && !data.groupId)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message data' }));
                        return;
                    }
                    
                    if (data.to && (blockedUsersDB.get(data.to) || new Set()).has(userKey)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'You are blocked by this user' }));
                        return;
                    }
                    
                    const messageData = {
                        id: uuidv4(),
                        from: userKey,
                        to: data.to,
                        groupId: data.groupId,
                        content: data.content,
                        isMedia: false,
                        timestamp: Date.now()
                    };
                    
                    const chatKey = data.groupId ? data.groupId : [userKey, data.to].sort().join(':');
                    if (!messageHistory.has(chatKey)) {
                        messageHistory.set(chatKey, []);
                    }
                    messageHistory.get(chatKey).push(messageData);
                    await saveData();
                    
                    if (data.to) {
                        const recipientWs = users.get(data.to);
                        if (recipientWs) {
                            recipientWs.send(JSON.stringify({
                                type: 'message',
                                ...messageData,
                                fromUsername: usersDB.get(userKey).username
                            }));
                        }
                    } else if (data.groupId && groups.has(data.groupId)) {
                        groups.get(data.groupId).forEach(memberKey => {
                            if (memberKey !== userKey) {
                                const memberWs = users.get(memberKey);
                                if (memberWs) {
                                    memberWs.send(JSON.stringify({
                                        type: 'message',
                                        ...messageData,
                                        fromUsername: usersDB.get(userKey).username
                                    }));
                                }
                            }
                        });
                    }
                    break;

                case 'typing':
                    if (data.to) {
                        const recipientWs = users.get(data.to);
                        if (recipientWs) {
                            recipientWs.send(JSON.stringify({
                                type: 'typing',
                                from: userKey,
                                fromUsername: usersDB.get(userKey).username,
                                isTyping: data.isTyping
                            }));
                        }
                    } else if (data.groupId && groups.has(data.groupId)) {
                        groups.get(data.groupId).forEach(memberKey => {
                            if (memberKey !== userKey) {
                                const memberWs = users.get(memberKey);
                                if (memberWs) {
                                    memberWs.send(JSON.stringify({
                                        type: 'typing',
                                        from: userKey,
                                        fromUsername: usersDB.get(userKey).username,
                                        isTyping: data.isTyping
                                    }));
                                }
                            }
                        });
                    }
                    break;

                case 'call_offer':
                case 'call_answer':
                case 'call_ice_candidate':
                case 'call_end':
                    if (data.to && users.has(data.to)) {
                        const recipientWs = users.get(data.to);
                        if (recipientWs) {
                            recipientWs.send(JSON.stringify({
                                type: data.type,
                                from: userKey,
                                fromUsername: usersDB.get(userKey).username,
                                [data.type === 'call_offer' ? 'offer' : 
                                 data.type === 'call_answer' ? 'answer' : 'candidate']: 
                                    data.offer || data.answer || data.candidate,
                                callId: data.callId,
                                callType: data.callType
                            }));
                        }
                    }
                    break;

                case 'status_update':
                    if (['online', 'away', 'busy', 'invisible'].includes(data.status)) {
                        const user = usersDB.get(userKey);
                        user.status = data.status;
                        usersDB.set(userKey, user);
                        await saveData();
                        broadcastStatus(userKey, data.status);
                    }
                    break;
            }
        } catch (error) {
            logMessage(`WebSocket message error: ${error.message}`);
            ws.send(JSON.stringify({ type: 'error', message: 'Message processing failed' }));
        }
    });

    ws.on('close', async () => {
        if (userKey) {
            users.delete(userKey);
            const user = usersDB.get(userKey);
            if (user) {
                user.status = 'offline';
                user.lastSeen = Date.now();
                usersDB.set(userKey, user);
                await saveData();
                broadcastStatus(userKey, 'offline');
            }
        }
    });

    ws.on('error', (error) => {
        logMessage(`WebSocket error: ${error.message}`);
    });
});

function broadcastStatus(userKey, status) {
    (friendsDB.get(userKey) || new Set()).forEach(friendKey => {
        const friendWs = users.get(friendKey);
        if (friendWs) {
            friendWs.send(JSON.stringify({
                type: 'friend_status_update',
                userKey,
                status
            }));
        }
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Graceful shutdown...');
    
    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
        ws.close();
    });
    
    // Save data one last time
    try {
        await saveData();
        console.log('Data saved successfully');
    } catch (error) {
        console.error('Error saving data during shutdown:', error.message);
    }
    
    // Close log stream
    logStream.end();
    
    // Close server
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logMessage(`Server running on port ${PORT}`);
    console.log(`🚀 Secure Chat Server started on port ${PORT}`);
    console.log(`📝 Logs are saved to: ${logDir}`);
    console.log(`💾 Data is saved to: ${DATA_FILE}`);
});
