# Superjoin Hiring Assignment

### Welcome to Superjoin's hiring assignment! 🚀

### Objective
Build a solution that enables real-time synchronization of data between a Google Sheet and a specified database (e.g., MySQL, PostgreSQL). The solution should detect changes in the Google Sheet and update the database accordingly, and vice versa.

### Problem Statement
Many businesses use Google Sheets for collaborative data management and databases for more robust and scalable data storage. However, keeping the data synchronized between Google Sheets and databases is often a manual and error-prone process. Your task is to develop a solution that automates this synchronization, ensuring that changes in one are reflected in the other in real-time.

---

### Requirements:

1. **Real-time Synchronization**:
   - Implement a system that detects changes in Google Sheets and updates the database accordingly.
   - Similarly, detect changes in the database and update the Google Sheet.
  
2. **CRUD Operations**:
   - Ensure the system supports Create, Read, Update, and Delete operations for both Google Sheets and the database.
   - Maintain data consistency across both platforms.
   
---

### Optional Challenges (Not Mandatory):

1. **Conflict Handling**:
   - Develop a strategy to handle conflicts that may arise when changes are made simultaneously in both Google Sheets and the database.
   - Provide options for conflict resolution (e.g., last write wins, user-defined rules).
    
2. **Scalability**:  
   - Ensure the solution can handle large datasets and high-frequency updates without performance degradation.
   - Optimize for scalability and efficiency.

---

## Submission Checklist

- [x] My code's working just fine! 🥳
- [x] I have recorded a video showing it working and embedded it in the README ▶️
- [x] I have tested all the normal working cases 😎
- [x] I have even solved some edge cases (brownie points) 💪
- [x] I added my very planned-out approach to the problem at the end of this README 📜

---

### How to Run the Project

1. **Google OAuth2 Authentication**:
   - Visit `http://localhost:3000/auth` to authenticate the application with Google Sheets API.
   - Follow the authentication flow and authorize access to the specified Google Sheet.
   - Run `http://localhost:3000/syncToSheets` manually to set inital spreadsheet data into database
   -[Click here to view the Google Spreadsheet](https://docs.google.com/spreadsheets/d/1LCHR_SPMW-0fJBMk8AH8vINX-uiPd6SLBAt28e1nFr8/edit?usp=sharing)

2. **Synchronizing Data**:
   - Use `http://localhost:3000/syncToSheets` to sync data from Google Sheets to the MySQL database.
   - Use `http://localhost:3000/syncFromSheets` to sync any changes from the MySQL database to the Google Sheet.

3. **Polling**:
   - The system automatically polls the `sync_log` table in the MySQL database every 5 seconds to detect changes and synchronize them back to Google Sheets.


---

### Developer’s Section

#### Approach:

- **OAuth2 Setup**:
  I set up Google OAuth2 to securely access the Google Sheets API, allowing read and write operations on the sheet.

- **Syncing Google Sheets to MySQL**:
  When synchronizing Google Sheets to MySQL, the program fetches data from the sheet and inserts or updates the MySQL `students` table based on the current state of the data.

- **Syncing MySQL to Google Sheets**:
  The sync mechanism checks the `sync_log` table for any changes (insert, update, delete operations) and applies the necessary modifications to the Google Sheet.

- **Polling for Changes**:
  The application checks the database every 5 seconds to detect any changes made and synchronizes those changes with Google Sheets. This ensures real-time synchronization.

#### Challenges & Solutions:
  - Creating a gcp account with HDFC bank
  - Prevent auto trigger between mysql and auto script causing duplication.
  - The biggest challenge was maintaining real-time sync between Google Sheets and the database without overloading the API with requests. The use of a `sync_log` table in the database helped in identifying and processing changes efficiently.

---

### Video Demonstration:

[Click here to view the video](https://drive.google.com/file/d/1phd96N-k8yymvBMx8OdiKL4ibMuha4Ap/view?usp=sharing)

---

## Got Questions?

Feel free to check the discussions tab, you might get some help there. Check out that tab before reaching out to us. Also, did you know, the internet is a great place to explore? 😛

We’re available at techhiring@superjoin.ai for all queries.

All the best! ✨
