require('dotenv').config();
const { Pool } = require('pg');

const testConnection = async () => {
  console.log('🔍 Starting database connection test...\n');
  
  // Configuration with fallback values
  const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'gocar',
    password: process.env.DB_PASSWORD || 'ckanmani',
    port: process.env.DB_PORT || 5432,
  };

  console.log('⚙️ Using configuration:');
  console.table(config);

  const pool = new Pool(config);

  try {
    // 1. Basic connection test
    console.log('\n🔌 Testing basic connection...');
    const timeRes = await pool.query('SELECT NOW()');
    console.log('🕒 Database time:', timeRes.rows[0].now);

    // 2. Verify tables
    console.log('\n🔎 Checking tables...');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n📊 Tables found:');
    console.table(tablesRes.rows);

    // 3. Check if users table exists
    const usersTableExists = tablesRes.rows.some(row => row.table_name === 'users');
    
    if (!usersTableExists) {
      console.error('\n❌ Users table does not exist');
      console.log('\n💡 Solution: Create the users table first');
    } else {
      console.log('\n✅ Users table exists');
      
      // 4. Insert test data for Naveen (only name, email, phone)
      console.log('\n➕ Inserting test user: Naveen');
      try {
        const insertRes = await pool.query(`
          INSERT INTO users (name, email, phone)
          VALUES ($1, $2, $3)
          RETURNING user_id, name, email, phone`,
          ['sheel', 'sheela@gmail.com', '7200904892']
        );
        
        console.log('\n🎉 Successfully inserted user:');
        console.table(insertRes.rows[0]);
        
        // 5. Verify the inserted data
        const verifyRes = await pool.query(`
          SELECT user_id, name, email, phone 
          FROM users 
          WHERE email = 'mcnaveenraj@gmail.com'
        `);
        
        console.log('\n🔍 Verification:');
        console.table(verifyRes.rows);
        
      } catch (insertErr) {
        if (insertErr.code === '23505') {
          console.log('\nℹ️ User already exists, fetching existing record:');
          const existingUser = await pool.query(`
            SELECT user_id, name, email, phone 
            FROM users 
            WHERE email = 'mcnaveenraj@gmail.com'
          `);
          console.table(existingUser.rows[0]);
        } else {
          console.error('\n❌ Failed to insert user:', insertErr.message);
        }
      }
    }
  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    
    console.log('\n🔧 Detailed troubleshooting:');
    console.log('1. Verify PostgreSQL service is running:');
    console.log('   Linux/Mac: sudo service postgresql status');
    console.log('   Windows: Check Services for "postgresql"');
    
    console.log('\n2. Test connection manually:');
    console.log(`   psql -U ${config.user} -h ${config.host} -p ${config.port} -d ${config.database}`);
    
    console.log('\n3. Check your .env file contains:');
    console.log(`   DB_USER=${config.user}`);
    console.log(`   DB_HOST=${config.host}`);
    console.log(`   DB_DATABASE=${config.database}`);
    console.log(`   DB_PORT=${config.port}`);
  } finally {
    await pool.end();
    console.log('\n🔚 Connection closed');
  }
};

testConnection();