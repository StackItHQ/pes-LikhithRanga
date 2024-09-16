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

// Load tokens from file if available
const TOKEN_PATH = 'token.json';
if (fs.existsSync(TOKEN_PATH)) {
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(tokens);
}

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

    // Save tokens to a file for future use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

    res.send('Authentication successful! Open: http://localhost:3000/syncToSheets To begin Synchronization!!');
  } catch (err) {
    console.error('Error during authentication:', err);
    res.status(500).send('Authentication error.');
  }
});

// Function to get data from Google Sheets
async function getSheetData() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Class Data!A2:F',
    });
    return response.data.values;
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error.message);
    throw error;
  }
}

// Route to read and sync Google Sheets data to MySQL
app.get('/syncToSheets', async (req, res) => {
  try {
    const data = await getSheetData();
    if (!data) {
      return res.status(400).send('No data found.');
    }

    // Check if the table is empty or data exists
    db.query('SELECT 1 FROM students LIMIT 1', (err, results) => {
      if (err) throw err;

      if (results.length === 0) {
        // Table is empty, insert all rows with ROW_ID
        const insertQuery = `INSERT INTO students (ROW_ID, name, gender, class_level, home_state, major, extracurricular)
                             VALUES ?`;
        const dataWithRowIds = data.map((row, index) => [index + 1, ...row]);  // Assuming ROW_ID starts at 1
        db.query(insertQuery, [dataWithRowIds], (err, result) => {
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

// Route to sync data from Google Sheets to MySQL and handle updates and deletions
app.post('/syncFromSheets', async (req, res) => {
  try {
    const data = await getSheetData();
    if (!data) {
      console.log('No data found in Google Sheets.');
      return res.status(400).send('No data found in Google Sheets.');
    }

    db.query('SELECT * FROM students', (err, mysqlResults) => {
      if (err) throw err;

      const mysqlDataMap = new Map();
      mysqlResults.forEach(row => {
        mysqlDataMap.set(row.ROW_ID, row);
      });

      const processedRowIds = new Set();

      data.forEach((row, index) => {
        const rowId = index + 2;  // Assuming ROW_ID starts at 1 (adjust if necessary)

        processedRowIds.add(rowId);

        const mysqlRow = mysqlDataMap.get(rowId);

        if (mysqlRow) {
          const isDifferent = row[0] !== mysqlRow.name || row[1] !== mysqlRow.gender ||
                              row[2] !== mysqlRow.class_level || row[3] !== mysqlRow.home_state ||
                              row[4] !== mysqlRow.major || row[5] !== mysqlRow.extracurricular;

          if (isDifferent) {
            db.query(
              'UPDATE students SET name = ?, gender = ?, class_level = ?, home_state = ?, major = ?, extracurricular = ? WHERE ROW_ID = ?',
              [...row, rowId],
              (err, result) => {
                if (err) throw err;
                console.log(`Updation for ROW_ID: ${rowId}`);
              }
            );
          }
        } else {
          const insertQuery = `INSERT INTO students (ROW_ID, name, gender, class_level, home_state, major, extracurricular)
                               VALUES (?, ?, ?, ?, ?, ?, ?)`;
          db.query(insertQuery, [rowId, ...row], (err, result) => {
            if (err) throw err;
            console.log(`Creation for ROW_ID: ${rowId}`);
          });
        }
      });

      mysqlResults.forEach(mysqlRow => {
        if (!processedRowIds.has(mysqlRow.ROW_ID)) {
          console.log(`Deletion for ROW_ID: ${mysqlRow.ROW_ID}`);

          db.query('DELETE FROM students WHERE ROW_ID = ?', [mysqlRow.ROW_ID], (err, result) => {
            if (err) throw err;
            console.log(`Row deleted for ROW_ID: ${mysqlRow.ROW_ID}`);
          });
        }
      });
    });

    res.send('Data synchronized from Sheets to MySQL.');
  } catch (err) {
    console.error('Error syncing data from Sheets:', err.message);
    res.status(500).send('Error syncing data from Sheets.');
  }
});



// Function to sync from DB based on sync_log
async function syncFromDB() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    
    // Fetch the sync log from the database
    db.query('SELECT * FROM sync_log ORDER BY timestamp ASC', async (err, syncLogs) => {
      if (err) throw err;

      for (const log of syncLogs) {
        const { row_id, operation_type } = log;

        if (operation_type === 'insert') {
          // Fetch the inserted row data from the DB
          db.query('SELECT * FROM students WHERE ROW_ID = ?', [row_id], async (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
              const row = results[0];
              const values = [
                [row.name, row.gender, row.class_level, row.home_state, row.major, row.extracurricular]
              ];
              // Insert the new row into Google Sheets
              await sheets.spreadsheets.values.append({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Class Data!A:F',
                valueInputOption: 'RAW',
                resource: { values },
              });
              console.log(`Inserted row ${row_id} into Google Sheets`);
            }
          });
        } else if (operation_type === 'update') {
          // Fetch the updated row data
          db.query('SELECT * FROM students WHERE ROW_ID = ?', [row_id], async (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
              const row = results[0];
              const range = `Class Data!A${row_id}:F${row_id}`;  // Correct range format
              const values = [
                [row.name, row.gender, row.class_level, row.home_state, row.major, row.extracurricular]
              ];
              // Update the specific row in Google Sheets
              await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range,
                valueInputOption: 'RAW',
                resource: { values },
              });
              console.log(`Updated row ${row_id} in Google Sheets`);
            }
          });
        } else if (operation_type === 'delete') {
          // Delete the corresponding row in Google Sheets
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            resource: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId: 0, // Sheet ID (from earlier)
                      dimension: 'ROWS',
                      startIndex: row_id - 1,  // Correct start index (0-based)
                      endIndex: row_id,  // Correct end index
                    },
                  },
                },
              ],
            },
          });
          console.log(`Deleted row ${row_id} from Google Sheets`);
        }

        // Clean up the sync_log after processing
        db.query('DELETE FROM sync_log WHERE id = ?', [log.id], (err, result) => {
          if (err) throw err;
          console.log(`Processed and removed log entry with id ${log.id}`);
        });
      }
    });
  } catch (error) {
    console.error('Error during syncFromDB:', error.message);
  }
}



// Set up polling to check for changes in sync_log every 5 seconds
setInterval(syncFromDB, 5000);

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
  console.log("OPEN: http://localhost:" + process.env.PORT + "/auth for Authentication!!");
});
