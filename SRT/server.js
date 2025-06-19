const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// בסיס הנתונים
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbPath);

// Middleware
app.use(bodyParser.json());

// הגדרת תיקיית Static (מוגנת בסיסמה)
const PASSWORD = '1234'; // שנה כאן את הסיסמה אם תרצה

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next(); // לא נבדוק API
  if (req.path.startsWith('/public') || req.path === '/' || req.path === '/index.html') {
    const auth = req.headers.authorization;
    if (auth && auth === 'Basic ' + Buffer.from(`admin:${PASSWORD}`).toString('base64')) {
      return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Protected Area"');
    return res.status(401).send('Unauthorized');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// יצירת טבלאות אם אינן קיימות
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    code TEXT UNIQUE,
    address TEXT,
    phone TEXT,
    manager_phone TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS computers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT,
    code TEXT UNIQUE,
    branch_id INTEGER,
    recalled INTEGER DEFAULT 0,
    FOREIGN KEY(branch_id) REFERENCES branches(id)
  )`);
});

// --- API ---
// סניפים
app.get('/api/branches', (req, res) => {
  db.all('SELECT * FROM branches', (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

app.post('/api/branches', (req, res) => {
  const { name, address, phone, manager_phone } = req.body;
  const code = String(Math.floor(100 + Math.random() * 900));
  db.run(
    `INSERT INTO branches (name, code, address, phone, manager_phone) VALUES (?, ?, ?, ?, ?)`,
    [name, code, address, phone, manager_phone],
    function (err) {
      if (err) return res.status(500).send(err);
      res.json({ id: this.lastID, code });
    }
  );
});

app.put('/api/branches/:id', (req, res) => {
  const { name, address, phone, manager_phone, code } = req.body;
  const id = req.params.id;
  db.run(
    `UPDATE branches SET name = ?, address = ?, phone = ?, manager_phone = ?, code = ? WHERE id = ?`,
    [name, address, phone, manager_phone, code, id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});

app.delete('/api/branches/:id', (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM branches WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).send(err);
    res.sendStatus(200);
  });
});

// מחשבים
app.get('/api/computers', (req, res) => {
  const sql = `
    SELECT computers.*, branches.name AS branch_name
    FROM computers
    LEFT JOIN branches ON computers.branch_id = branches.id
    WHERE recalled = 0
  `;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

app.post('/api/computers', (req, res) => {
  const { model, branch_id } = req.body;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  db.run(
    `INSERT INTO computers (model, code, branch_id) VALUES (?, ?, ?)`,
    [model, code, branch_id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.json({ id: this.lastID, code });
    }
  );
});

app.delete('/api/computers/:id', (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM computers WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).send(err);
    res.sendStatus(200);
  });
});

app.post('/api/computers/:id/recall', (req, res) => {
  const id = req.params.id;
  db.run(
    `UPDATE computers SET recalled = 1, branch_id = NULL WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});

app.post('/api/computers/:id/return', (req, res) => {
  const id = req.params.id;
  const { branch_id } = req.body;
  db.run(
    `UPDATE computers SET recalled = 0, branch_id = ? WHERE id = ?`,
    [branch_id, id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});

// ריקול
app.get('/api/recalls', (req, res) => {
  db.all(`SELECT * FROM computers WHERE recalled = 1`, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// הפעלת שרת
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
