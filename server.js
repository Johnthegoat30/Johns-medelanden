const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Databaskonfiguration
const db = new sqlite3.Database('./database.db');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'hemlig_sessionnyckel_2024',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Skapa tabeller
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_user_id) REFERENCES users(id),
    FOREIGN KEY(to_user_id) REFERENCES users(id)
  )`);
});

// Registrering
app.post('/register', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) {
    return res.json({ success: false, message: 'Alla fält måste fyllas i' });
  }

  if (password !== confirmPassword) {
    return res.json({ success: false, message: 'Lösenorden matchar inte' });
  }

  if (password.length < 6) {
    return res.json({ success: false, message: 'Lösenordet måste vara minst 6 tecken' });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.json({ success: false, message: 'Användarnamnet finns redan' });
      }
      return res.json({ success: false, message: 'Registrering misslyckades' });
    }
    res.json({ success: true, message: 'Registrering lyckades! Logga in nu.' });
  });
});

// Inloggning
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: 'Användarnamn och lösenord krävs' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.json({ success: false, message: 'Databasfel' });
    }

    if (!user) {
      return res.json({ success: false, message: 'Användaren finns inte' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.json({ success: false, message: 'Lösenordet är felaktigt' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, message: 'Inloggning lyckades!', userId: user.id, username: user.username });
  });
});

// Logga ut
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, message: 'Utloggning misslyckades' });
    }
    res.json({ success: true, message: 'Du är utloggad' });
  });
});

// Hämta inloggad användare
app.get('/user', (req, res) => {
  if (req.session.userId) {
    res.json({ success: true, userId: req.session.userId, username: req.session.username });
  } else {
    res.json({ success: false, message: 'Inte inloggad' });
  }
});

// WebSocket för realtidsmeddelanden
wss.on('connection', (ws) => {
  console.log('Ny WebSocket-anslutning');

  ws.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data);
      
      // Spara meddelande i databas
      db.run(
        "INSERT INTO messages (from_user_id, to_user_id, message) VALUES (?, ?, ?)",
        [parsedData.fromUserId, parsedData.toUserId, parsedData.message],
        function(err) {
          if (!err) {
            // Skicka meddelande till alla anslutna klienter
            wss.clients.forEach((client) => {
              if (client.readyState === 1) { // 1 = OPEN
                client.send(JSON.stringify({
                  type: 'message',
                  fromUserId: parsedData.fromUserId,
                  fromUsername: parsedData.fromUsername,
                  toUserId: parsedData.toUserId,
                  message: parsedData.message,
                  timestamp: new Date().toLocaleTimeString('sv-SE')
                }));
              }
            });
          }
        }
      );
    } catch (err) {
      console.error('WebSocket-fel:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket-anslutning stängd');
  });
});

// Starta server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servern körs på http://localhost:${PORT}`);
});
