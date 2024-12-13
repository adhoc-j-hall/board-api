// dependencies
import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise'; // Import mysql2 with promise support
import cors from 'cors';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import authenticateToken from './middleware/authMiddleware.js'; // Adjust the path as necessary
import ejs from 'ejs';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 8081;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8080', 'http://127.0.0.1:8889', 'db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'http://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'https://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'https://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'https://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'http://http://webappapi.com', 'https://http://webappapi.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
// View engine setup 
app.set('view engine', 'ejs');
app.use(cors(corsOptions));

// MySQL connection
let db;
(async () => {
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('Connected to database');
    } catch (err) {
        console.error('Database connection failed:', err);
    }
})();

app.render('email', function (err, html) {
    if (err) console.log(err);
    console.log(html);
});

// Rate limiter configuration
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again in 5 minutes.'
});

// SIGN UP ROUTE
app.post('/signup', async (req, res) => {
    const { email_address, username, first_name, last_name, password, email_verified } = req.body;

    if (!email_address || !username || !password) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = 'INSERT INTO users (email_address, username, first_name, last_name, password, email_verified) VALUES (?, ?, ?, ?, ?, false)';
        const [result] = await db.query(query, [email_address, username, first_name, last_name, hashedPassword, email_verified]);

        res.send('Sign up successful!');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).send('Username or email address already exists');
        }
        console.error(err);
        res.status(500).send('Server error');
    }
});
//LOGIN ROUTE
app.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Query to find the user by username or email
        const query = 'SELECT * FROM users WHERE username = ? OR email_address = ?';
        const [results] = await db.query(query, [username, username]);

        if (results.length === 0) {
            return res.status(400).send('Invalid username or password');
        }

        const user = results[0];

        // Compare the provided password with the stored hashed password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).send('Invalid username or password');
        }

        // Generate a JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Authentication successful
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email_address,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
            },
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
// Route to fetch all users
app.get('/test', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM users');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
// Route to fetch all users
app.get('/usersFetch', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM users');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/', (req, res) => {
    res.render('index'); // Assuming you have an 'index.ejs' file in your views folder
});

app.listen(port, () => {
    console.log(`Auth server running on http://localhost:${port}`);
});
