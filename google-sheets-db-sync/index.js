const fs = require('fs');
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(bodyParser.json());

// Load OAuth2 credentials
const CREDENTIALS = JSON.parse(fs.readFileSync('credentials.json'));
const { client_secret, client_id, redirect_uris } = CREDENTIALS.web;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// MySQL database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Connect to MySQL
db.connect(err => {
  if (err) throw err;
  console.log('Connected to the MySQL database.');
});

// Route to get Google OAuth2 URL
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
  res.redirect(authUrl);
});

// OAuth2 callback route
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    res.send('Authentication successful! Open:http://localhost:3000/sync To begin Synchronization!!');
  } catch (err) {
    console.error('Error during authentication:', err);
    res.status(500).send('Authentication error.');
  }
});

async function getSheetData() {
    try {
      const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: '1LCHR_SPMW-0fJBMk8AH8vINX-uiPd6SLBAt28e1nFr8',
        range: 'Class Data!A2:F', 
      });
      // console.log(response.data); 
      return response.data.values;
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error.message);
    }
  }
  
// Route to read and sync Google Sheets data to MySQL
app.get('/sync', async (req, res) => {
  try {
    const data = await getSheetData();
    if (!data) {
      return res.status(400).send('No data found.');
    }

    // Check if the table is empty
    db.query('SELECT 1 FROM students LIMIT 1', (err, results) => {
      if (err) throw err;

      if (results.length === 0) {
        // Table is empty, insert all rows
        const insertQuery = `INSERT INTO students (name, gender, class_level, home_state, major, extracurricular)
                             VALUES ?`;
        db.query(insertQuery, [data], (err, result) => {
          if (err) throw err;
          console.log('Initial data inserted.');
        });
      }
    });

    res.send('Data synchronized successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error syncing data.');
  }
});

app.post('/webhook-sync', async (req, res) => {
  try {
    const { row, data } = req.body;

    if (!row || !data) {
      return res.status(400).send('Missing data in webhook request.');
    }

    const query = `UPDATE students 
                   SET name = ?, gender = ?, class_level = ?, home_state = ?, major = ?, extracurricular = ?
                   WHERE ROW_ID = ?`;

    db.query(query, [data[0], data[1], data[2], data[3], data[4], data[5], row], (err, result) => {
      if (err) throw err;

      if (result.affectedRows === 0) {
        console.log(`No rows updated for row ID: ${row}`); 
      }

      res.send('Data synchronized successfully.');
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error syncing data.');
  }
});



// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
  console.log("OPEN: http://localhost:3000/auth for Authentication!!")
});

