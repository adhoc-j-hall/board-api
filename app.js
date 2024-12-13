// dependencies
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mysql from 'mysql2/promise'; // Import mysql2 with promise support
import dotenv from 'dotenv';
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

// MySQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};
app.render('email', function (err, html) {
    if (err) console.log(err);
    console.log(html);
});
// Route to handle form submission
app.post('/signup', async (req, res) => {
    const { email_address, username, first_name, last_name, password, email_verified } = req.body;

    if (!email_address || !username || !password) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = 'INSERT INTO users (email_address, username, first_name, last_name, password, email_verified) VALUES (?, ?, ?, ?, ?, false)';
        db.query(query, [email_address, username, first_name, last_name, hashedPassword, email_verified], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send('Username or email address already exists');
                }
                throw err;
            }
            res.send('Sign up successful!');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
// Route to fetch all users
app.get('/usersFetch', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM users');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});
app.get('/', (req, res) => {
    res.render('index'); // Assuming you have an 'index.ejs' file in your views folder
});
app.listen(port, () => {
    console.log(`Auth server running on http://localhost:${port}`);
});
