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
app.use(bodyParser.json()); // Add this line to parse JSON bodies

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8080', 'http://127.0.0.1:8889', '127.0.0.1:8081', 'db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'http://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'https://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'https://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'https://db-mysql-lon1-12964-do-user-18318316-0.i.db.ondigitalocean.com', 'http://http://webappapi.com', 'https://http://webappapi.com'],
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

// Rate limiter configuration
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again in 5 minutes.'
});

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

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

app.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Missing required fields');
    }

    // Query to find the user by username or email
    const query = 'SELECT * FROM users WHERE username = ? OR email_address = ?';
    db.query(query, [username, username], async (err, results) => {
        if (err) throw err;

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
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

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
    });
});


//user authentication route
app.get('/user', authenticateToken, async (req, res) => {
    res.json({ user: req.user });
});

//POST TO BOARD ROUTE
app.post('/posts', authenticateToken, async (req, res) => {
    const { user_id, title, content } = req.body;

    if (!title || !content) {
        return res.status(400).send('Missing required fields.');
    }

    try {
        const query = 'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)';
        db.query(query, [user_id, title, content], (err, result) => {
            if (err) {
                throw err;
            }
            res.status(201).send('Post created successfully!');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});
// DELETE POST ROUTE
app.delete('/posts/:postId/delete', async (req, res) => {
    const { postId } = req.params;
    const { user_id } = req.body; // Assuming user_id is passed in the body for verification

    try {
        // Check if the post exists and belongs to the user
        const checkQuery = 'SELECT * FROM posts WHERE post_id = ? AND user_id = ?';
        db.query(checkQuery, [postId, user_id], (err, results) => {
            if (err) {
                throw err;
            }
            if (results.length === 0) {
                return res.status(404).send('Post not found or you do not have permission to delete this post.');
            }

            // Delete associated post likes
            const deletePostLikesQuery = 'DELETE FROM post_likes WHERE post_id = ?';
            db.query(deletePostLikesQuery, [postId], (err, result) => {
                if (err) {
                    throw err;
                }

                // Delete associated comment likes first
                const deleteCommentLikesQuery = `
                    DELETE comment_likes 
                    FROM comment_likes 
                    JOIN comments ON comment_likes.comment_id = comments.id 
                    WHERE comments.post_id = ?
                `;
                db.query(deleteCommentLikesQuery, [postId], (err, result) => {
                    if (err) {
                        throw err;
                    }

                    // Delete associated comments
                    const deleteCommentsQuery = 'DELETE FROM comments WHERE post_id = ?';
                    db.query(deleteCommentsQuery, [postId], (err, result) => {
                        if (err) {
                            throw err;
                        }

                        // Delete the post
                        const deletePostQuery = 'DELETE FROM posts WHERE post_id = ?';
                        db.query(deletePostQuery, [postId], (err, result) => {
                            if (err) {
                                throw err;
                            }
                            res.status(200).send('Post and associated comments, likes deleted successfully!');
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});
//GET LATEST 10 POSTS
app.get('/posts/latest', async (req, res) => {
    const { user_id } = req.query; // Assuming user_id is passed as a query parameter

    try {
        const query = `
            SELECT 
    posts.*, 
    users.username AS author_name, 
    (SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.post_id) AS like_count, 
    (SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_likes.post_id = posts.post_id AND post_likes.user_id = 1)) AS likedByUser,
    (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.post_id) AS post_comment_count
FROM 
    posts 
JOIN 
    users ON posts.user_id = users.id 
ORDER BY 
    posts.created_at DESC 
LIMIT 10;
        `;
        db.query(query, [user_id], (err, results) => {
            if (err) {
                throw err;
            }
            res.status(200).json(results);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});
//route to like/unlike a post:
app.post('/posts/:postId/like', async (req, res) => {
    const { postId } = req.params;
    const { user_id } = req.body;

    try {
        // Check if the user has already liked the post
        const checkQuery = 'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?';
        db.query(checkQuery, [postId, user_id], (err, results) => {
            if (err) {
                throw err;
            }

            if (results.length > 0) {
                // User has already liked the post, so unlike it
                const deleteQuery = 'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?';
                db.query(deleteQuery, [postId, user_id], (err, result) => {
                    if (err) {
                        throw err;
                    }
                    res.status(200).send('Post unliked');
                });
            } else {
                // User has not liked the post, so like it
                const insertQuery = 'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)';
                db.query(insertQuery, [postId, user_id], (err, result) => {
                    if (err) {
                        throw err;
                    }
                    res.status(201).send('Post liked');
                });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});
app.get('/posts/:postId/likes', async (req, res) => {
    const { postId } = req.params;
    const { user_id } = req.query; // Assuming user_id is passed as a query parameter

    try {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) AS like_count, 
                (SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?)) AS likedByUser`;
        db.query(query, [postId, postId, user_id], (err, results) => {
            if (err) {
                throw err;
            }
            res.status(200).json(results[0]);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});
// POST route to create a new comment
app.post('/comments', async (req, res) => {
    const { post_id, user_id, content } = req.body;

    if (!post_id || !content) {
        return res.status(400).send('Missing required fields.');
    }

    try {
        const query = 'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)';
        db.query(query, [post_id, user_id, content], (err, result) => {
            if (err) {
                throw err;
            }
            res.status(201).send('Comment posted!');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});
// GET route to retrieve comments for a post
app.get('/posts/:postId/comments', async (req, res) => {
    const { postId } = req.params;
    try {
        const query = `
        SELECT comments.*, users.username AS author_name
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.post_id = ?
        ORDER BY comments.created_at DESC
      `;
        db.query(query, [postId], (err, results) => {
            if (err) {
                throw err;
            }
            res.status(200).json(results);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});

// POST route to like a comment
app.post('/comments/:commentId/like', async (req, res) => {
    const { commentId } = req.params;
    const { user_id } = req.body;

    try {
        // Check if the user has already liked the comment
        const checkQuery = 'SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?';
        db.query(checkQuery, [commentId, user_id], (err, results) => {
            if (err) {
                throw err;
            }

            if (results.length > 0) {
                // User has already liked the comment, so unlike it
                const deleteQuery = 'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?';
                db.query(deleteQuery, [commentId, user_id], (err, result) => {
                    if (err) {
                        throw err;
                    }
                    res.status(200).send('rgb(var(--mid-grey))');
                });
            } else {
                // User has not liked the comment, so like it
                const insertQuery = 'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)';
                db.query(insertQuery, [commentId, user_id], (err, result) => {
                    if (err) {
                        throw err;
                    }
                    res.status(201).send('rgb(var(--blue))');
                });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});

// GET route to retrieve likes for a comment
app.get('/comments/:commentId/likes', async (req, res) => {
    const { commentId } = req.params;
    const { user_id } = req.query; // Assuming user_id is passed as a query parameter

    try {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) AS like_count, 
                (SELECT EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?)) AS likedByUser
        `;
        db.query(query, [commentId, commentId, user_id], (err, results) => {
            if (err) {
                throw err;
            }
            res.status(200).json(results[0]);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
});

// test route
app.post('/test', async (req, res) => {

    try {
        res.send('Connected!');
    } catch (error) {
        console.error(error);
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


