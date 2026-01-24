const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (index.html, styles.css, script.js)
app.use(express.static(path.join(__dirname, '.')));

// Ensure database file exists
const dbFile = path.join(__dirname, 'bookings.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      customer_name TEXT NOT NULL,
      consultant_name TEXT,
      customer_location TEXT NOT NULL,
      booking_date TEXT,
      customer_phone TEXT NOT NULL,
      time_slot TEXT,
      test_drive_type TEXT,
      car_make TEXT,
      car_model TEXT,
      kilometers INTEGER,
      car_variant TEXT,
      year_of_manufacture TEXT
    );`
  );
});

// API to save booking
app.post('/api/bookings', (req, res) => {
  try {
    const b = req.body?.customer || {};

    const stmt = db.prepare(
      `INSERT INTO bookings (
        customer_name,
        consultant_name,
        customer_location,
        booking_date,
        customer_phone,
        time_slot,
        test_drive_type,
        car_make,
        car_model,
        kilometers,
        car_variant,
        year_of_manufacture
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );

    stmt.run(
      b.name || '',
      b.consultantName || '',
      b.location || '',
      b.bookingDate || '',
      b.phone || '',
      b.timeSlot || '',
      b.testDriveType || '',
      b.carMake || '',
      b.carModel || '',
      b.kilometers || null,
      b.carVariant || '',
      b.yearOfManufacture || '',
      function (err) {
        if (err) {
          console.error('Error inserting booking:', err);
          return res.status(500).json({ ok: false, error: 'Failed to save booking' });
        }
        res.json({ ok: true, id: this.lastID });
      }
    );

    stmt.finalize();
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ ok: false, error: 'Unexpected error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

