require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT) || 5432,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
  ssl: false,
});

// Test DB connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection error:', err));

// Create tables if not exists
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS location (
        location_id SERIAL PRIMARY KEY,
        pickup_location VARCHAR(255) NOT NULL,
        drop_location VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        location_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_distances (
        from_location_id INTEGER REFERENCES locations(location_id),
        to_location_id INTEGER REFERENCES locations(location_id),
        distance_km NUMERIC(5,2) NOT NULL,
        PRIMARY KEY (from_location_id, to_location_id)
      )
    `);

    console.log('Database tables verified/created');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'public')));
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Test endpoint
app.get('/test-connection', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1+1 AS result');
    res.json({
      success: true,
      database: 'Connected successfully',
      result: result.rows[0].result,
    });
  } catch (err) {
    console.error('Connection test failed:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: {
        code: err.code,
        config: pool.options,
      },
    });
  }
});

// Verify table endpoint
app.get('/verify-table', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      )
    `);
    res.json({
      tableExists: result.rows[0].exists,
      message: result.rows[0].exists
        ? 'Users table exists'
        : 'Users table DOES NOT exist',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'login.html'));
});

// Signup route
app.post('/api/users', async (req, res) => {
  console.log("Received body:", req.body);
  const { name, email, password, phone } = req.body;

  const errors = [];
  if (!name) errors.push('Name is required');
  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (!phone) errors.push('Phone is required');
  if (phone && !/^\d{10}$/.test(phone)) errors.push('Phone must be 10 digits');

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const userExists = await pool.query(
      'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, phone`,
      [name, email, password, phone]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({ error: 'Database operation failed', details: err.message });
  }
});

// Login route
app.post('/api/users/login', async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Name and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE name = $1',
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }

    const user = result.rows[0];

    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      user_id: user.user_id,
      message: 'Login successful'
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Ride creation API
app.post('/api/ride', async (req, res) => {
  const { pickup_location, drop_location } = req.body;

  if (!pickup_location || !drop_location) {
    return res.status(400).json({ error: 'Both pickup_location and drop_location are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO location (pickup_location, drop_location)
       VALUES ($1, $2) RETURNING location_id`,
      [pickup_location, drop_location]
    );

    res.status(201).json({ location_id: result.rows[0].location_id });
  } catch (err) {
    console.error('Failed to insert ride location:', err);
    res.status(500).json({
      error: 'Failed to save ride location',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get all drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers ORDER BY driver_id ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching driver details:', err);
    res.status(500).json({
      error: 'Failed to fetch driver details',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get random driver
app.get('/api/drivers/random', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers ORDER BY RANDOM() LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No drivers found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching random driver:', err);
    res.status(500).json({
      error: 'Failed to fetch random driver',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ... (keep all existing code until the distance endpoint)

// Get distance between locations
// server.js

app.get('/api/locations/distance', async (req, res) => {
    const { pickup, dropoff } = req.query;

    if (!pickup || !dropoff) {
        return res.status(400).json({ error: 'Both pickup and dropoff parameters are required' });
    }

    try {
        // Find location IDs (case-insensitive search)
        const pickupQuery = await pool.query(
            `SELECT location_id FROM locations 
             WHERE LOWER(name) LIKE LOWER($1) 
             LIMIT 1`,
            [`%${pickup}%`]
        );
        
        const dropoffQuery = await pool.query(
            `SELECT location_id FROM locations 
             WHERE LOWER(name) LIKE LOWER($1) 
             LIMIT 1`,
            [`%${dropoff}%`]
        );

        if (pickupQuery.rows.length === 0 || dropoffQuery.rows.length === 0) {
            return res.status(404).json({ error: 'One or both locations not found' });
        }

        const fromId = pickupQuery.rows[0].location_id;
        const toId = dropoffQuery.rows[0].location_id;

        // Check distance in both directions
        const distanceQuery = await pool.query(
            `SELECT distance_km FROM location_distances 
             WHERE (from_location_id = $1 AND to_location_id = $2)
             OR (from_location_id = $2 AND to_location_id = $1) 
             LIMIT 1`,
            [fromId, toId]
        );

        if (distanceQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Distance not found between these locations' });
        }

        res.json({
            distance_km: distanceQuery.rows[0].distance_km,
            pickup_location_id: fromId,
            dropoff_location_id: toId
        });
    } catch (err) {
        console.error('Error fetching distance:', err);
        res.status(500).json({ 
            error: 'Failed to calculate distance', 
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});
// ... (keep all remaining existing code)

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});