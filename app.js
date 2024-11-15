// dependencies
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';


const app = express();
const port = 8081;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Add this line to parse JSON bodies


// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8889', 'http://127.0.0.1:3306'], // Replace with your allowed domains
    methods: ['GET', 'POST', 'READ'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));


// test route
app.post('/test', async (req, res) => {

    try {
        res.send('Connected!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Auth server running on http://localhost:${port}`);
});