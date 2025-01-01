import express from 'express';
import cors from 'cors';
import { handler as whatsappHandler } from './functions/send-whatsapp.js';
import { handler as stripeHandler } from './functions/create-checkout.js';
import { handler as sessionHandler } from './functions/get-session.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 8888;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static('.'));

// Parse JSON bodies
app.use(express.json());

// Simulate Netlify function endpoints
async function handleNetlifyFunction(req, res, handler) {
    try {
        // Simulate Netlify's event object
        const event = {
            httpMethod: req.method,
            body: JSON.stringify(req.body),
            headers: req.headers,
            queryStringParameters: req.query
        };

        console.log('Function called:', {
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body
        });

        // Call the function handler
        const result = await handler(event);
        
        // Set headers from result
        if (result.headers) {
            Object.entries(result.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }

        // Send response
        res.status(result.statusCode).send(result.body);
    } catch (error) {
        console.error('Error in function:', error);
        res.status(500).json({ error: error.message });
    }
}

// WhatsApp notification endpoint
app.post('/.netlify/functions/send-whatsapp', (req, res) => {
    handleNetlifyFunction(req, res, whatsappHandler);
});

// Stripe checkout endpoint
app.post('/.netlify/functions/create-checkout', (req, res) => {
    handleNetlifyFunction(req, res, stripeHandler);
});

// Get session endpoint
app.get('/.netlify/functions/get-session', (req, res) => {
    handleNetlifyFunction(req, res, sessionHandler);
});

// Start server
app.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
    console.log('Environment variables:', {
        stripeKey: process.env.STRIPE_SECRET_KEY ? '****' : 'not set',
        whatsappPhone: process.env.WHATSAPP_PHONE || 'not set',
        whatsappApiKey: process.env.WHATSAPP_API_KEY ? '****' : 'not set'
    });
});
