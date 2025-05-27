const pool = require('./server');

const verifyDatabase = async () => {
  try {
    // Check users table
    const users = await pool.query('SELECT id, username FROM users LIMIT 1');
    console.log('Users table exists. Sample:', users.rows[0]);

    // Check rides table
    const rides = await pool.query(`
      SELECT r.id, u.username as passenger 
      FROM rides r
      JOIN users u ON r.passenger_id = u.id
      LIMIT 1
    `);
    console.log('Rides table exists. Sample:', rides.rows[0]);

  } catch (err) {
    console.error('Verification failed:', err.message);
    console.log('\n🔧 Suggested fixes:');
    console.log('1. Run these commands in psql to check tables:\n   \\dt\n   \\d users\n   \\d rides');
    console.log('2. If tables are missing, create them with:');
    console.log(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL
        -- Your other columns here
      );
      
      CREATE TABLE rides (
        id SERIAL PRIMARY KEY,
        passenger_id INTEGER REFERENCES users(id),
        -- Your other columns here
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } finally {
    pool.end();
  }
};

verifyDatabase();