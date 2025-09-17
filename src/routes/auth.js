const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../models/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'staff', first_name, last_name } = req.body;

    if (!username || !email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = getDatabase();
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, role, first_name, last_name],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const token = generateToken({
          id: this.lastID,
          username,
          role,
          email
        });

        res.status(201).json({
          message: 'User created successfully',
          token,
          user: {
            id: this.lastID,
            username,
            email,
            role,
            first_name,
            last_name
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();

    db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user);

        res.json({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
router.get('/profile', require('../middleware/auth').authenticateToken, (req, res) => {
  const db = getDatabase();

  db.get(
    'SELECT id, username, email, role, first_name, last_name, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    }
  );
});

module.exports = router;