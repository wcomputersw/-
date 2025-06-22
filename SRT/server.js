const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 רשימת משתמשים מורשים
const USERS = [
  { username: 'admin', password: 'WEIL0892@' },
  { username: 'lea', password: 'abc123@' }
];

// 📂 הגדרות בסיס
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(bodyParser.json());

app.use(session({
  secret: 'SOME_RANDOM_SECRET_KEY',
  resave: false,
  saveUninitialized: false
}));

// 🔒 הגנה על כל הדפים
app.use((req, res, next) => {
  if (
    req.path === '/login.html' ||
    req.path === '/api/login' ||
    req.path.startsWith('/public') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.js')
  ) {
    return next();
  }
  if (!req.session.authenticated) {
    return res.redirect('/login.html');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// 🔐 התחברות עם שם משתמש + סיסמה
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.authenticated = true;
    req.session.user = user.username;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }
});

// --- יצירת טבלאות ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('expense','income')),
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    code TEXT,
    address TEXT,
    phone TEXT,
    manager_phone TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS computers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT,
    code TEXT,
    branch_id INTEGER,
    recalled INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT,
    quantity INTEGER,
    description TEXT,
    amount REAL,
    date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT,
    quantity INTEGER,
    description TEXT,
    amount REAL,
    date TEXT
  )`);
});

// --- API סניפים ---
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
  db.run(
    `UPDATE branches SET name = ?, address = ?, phone = ?, manager_phone = ?, code = ? WHERE id = ?`,
    [name, address, phone, manager_phone, code, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});

app.delete('/api/branches/:id', (req, res) => {
  db.run(`DELETE FROM branches WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).send(err);
    res.sendStatus(200);
  });
});

// --- API מחשבים ---
app.get('/api/computers', (req, res) => {
  db.all(`SELECT * FROM computers WHERE recalled = 0`, (err, rows) => {
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

app.put('/api/computers/:id', (req, res) => {
  const { model, code } = req.body;
  db.run(
    `UPDATE computers SET model = ?, code = ? WHERE id = ?`,
    [model, code, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.sendStatus(200);
    }
  );
});

app.delete('/api/computers/:id', (req, res) => {
  db.run(`DELETE FROM computers WHERE id = ?`, [req.params.id], function (err) {
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

app.get('/api/recalls', (req, res) => {
  db.all(`SELECT * FROM computers WHERE recalled = 1`, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// --- API שותפים ---
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO users (name) VALUES (?)', [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/users/:id', (req, res) => {
  const { name } = req.body;
  db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

app.delete('/api/users/:id', (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// --- API קטגוריות ---
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/categories', (req, res) => {
  const { type, name } = req.body;
  db.run('INSERT INTO categories (type, name) VALUES (?, ?)', [type, name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/categories/:id', (req, res) => {
  const { name } = req.body;
  db.run('UPDATE categories SET name = ? WHERE id = ?', [name, req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

app.delete('/api/categories/:id', (req, res) => {
  db.run('DELETE FROM categories WHERE id = ?', [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// --- API הוצאות ---
app.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/expenses', (req, res) => {
  const { user_id, category, quantity, description, amount, date } = req.body;
  db.run(
    'INSERT INTO expenses (user_id, category, quantity, description, amount, date) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, category, quantity, description, amount, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/expenses/:id', (req, res) => {
  const { user_id, category, quantity, description, amount, date } = req.body;
  db.run(
    'UPDATE expenses SET user_id = ?, category = ?, quantity = ?, description = ?, amount = ?, date = ? WHERE id = ?',
    [user_id, category, quantity, description, amount, date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

app.delete('/api/expenses/:id', (req, res) => {
  db.run('DELETE FROM expenses WHERE id = ?', [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// --- API הכנסות ---
app.get('/api/income', (req, res) => {
  db.all('SELECT * FROM income ORDER BY date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/income', (req, res) => {
  const { user_id, category, quantity, description, amount, date } = req.body;
  db.run(
    'INSERT INTO income (user_id, category, quantity, description, amount, date) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, category, quantity, description, amount, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/income/:id', (req, res) => {
  const { user_id, category, quantity, description, amount, date } = req.body;
  db.run(
    'UPDATE income SET user_id = ?, category = ?, quantity = ?, description = ?, amount = ?, date = ? WHERE id = ?',
    [user_id, category, quantity, description, amount, date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

app.delete('/api/income/:id', (req, res) => {
  db.run('DELETE FROM income WHERE id = ?', [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// --- סיכום שותפים ---
app.get('/api/summary', (req, res) => {
  const summary = { users: {}, total: { expenses: 0, income: 0 } };

  db.all('SELECT * FROM users', (err, users) => {
    if (err) return res.status(500).json({ error: err.message });

    users.forEach(u => {
      summary.users[u.id] = {
        name: u.name,
        expenses_from_pocket: 0,
        withdrawn: 0,
        income: 0
      };
    });

    db.all('SELECT * FROM expenses', (err2, exps) => {
      if (err2) return res.status(500).json({ error: err2.message });

      exps.forEach(e => {
        if (summary.users[e.user_id]) {
          if (e.category === 'partner_withdraw') {
            summary.users[e.user_id].withdrawn += e.amount;
          } else {
            summary.users[e.user_id].expenses_from_pocket += e.amount;
            summary.total.expenses += e.amount;
          }
        }
      });

      db.all('SELECT user_id, amount FROM income', (err3, incs) => {
        if (err3) return res.status(500).json({ error: err3.message });

        incs.forEach(i => {
          if (summary.users[i.user_id]) {
            summary.users[i.user_id].income += i.amount;
            summary.total.income += i.amount;
          }
        });

        res.json(summary);
      });
    });
  });
});

// --- הרצת השרת ---
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
