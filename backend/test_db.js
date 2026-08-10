require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Test exact same query as createCustomer
    const [result] = await pool.execute(
      `INSERT INTO customers (name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Jane', '8888888888', 'jane_test_99@test.com', 'Jane Biz', null, 'retail', '456 Avenue', 'lead', null, null]
    );
    console.log('SUCCESS - insertId:', result.insertId);
  } catch (e) {
    console.error('EXACT ERROR:', e.message);
    console.error('SQL MESSAGE:', e.sqlMessage);
    console.error('SQL STATE:', e.sqlState);
    console.error('ERRNO:', e.errno);
  }

  await pool.end();
}

test();
