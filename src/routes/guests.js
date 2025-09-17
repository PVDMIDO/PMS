const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all guests
router.get('/', authenticateToken, (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM guests WHERE 1=1';
  const params = [];
  
  if (search) {
    query += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  query += ' ORDER BY last_name, first_name LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const db = getDatabase();
  
  db.all(query, params, (err, guests) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ guests });
  });
});

// Get guest by ID
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT * FROM guests WHERE id = ?', [req.params.id], (err, guest) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    
    res.json({ guest });
  });
});

// Get guest's reservation history
router.get('/:id/reservations', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const query = `
    SELECT r.*, rm.room_number, rt.name as room_type_name,
           CASE 
             WHEN r.status = 'checked_out' THEN 'Completed'
             WHEN r.status = 'checked_in' THEN 'Current Stay'
             WHEN r.status = 'confirmed' AND r.check_in_date > date('now') THEN 'Upcoming'
             WHEN r.status = 'confirmed' AND r.check_in_date <= date('now') THEN 'Expected'
             ELSE r.status
           END as display_status
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    JOIN room_types rt ON rm.room_type_id = rt.id
    WHERE r.guest_id = ?
    ORDER BY r.check_in_date DESC
  `;
  
  db.all(query, [req.params.id], (err, reservations) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ reservations });
  });
});

// Create new guest
router.post('/', authenticateToken, (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    country,
    id_type,
    id_number,
    date_of_birth
  } = req.body;
  
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }
  
  const db = getDatabase();
  
  db.run(
    `INSERT INTO guests (first_name, last_name, email, phone, address, city, country, id_type, id_number, date_of_birth) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [first_name, last_name, email, phone, address, city, country, id_type, id_number, date_of_birth],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create guest' });
      }
      
      res.status(201).json({
        message: 'Guest created successfully',
        guest: {
          id: this.lastID,
          first_name,
          last_name,
          email,
          phone,
          address,
          city,
          country,
          id_type,
          id_number,
          date_of_birth
        }
      });
    }
  );
});

// Update guest
router.put('/:id', authenticateToken, (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    country,
    id_type,
    id_number,
    date_of_birth
  } = req.body;
  
  const guestId = req.params.id;
  const db = getDatabase();
  
  db.run(
    `UPDATE guests 
     SET first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         city = COALESCE(?, city),
         country = COALESCE(?, country),
         id_type = COALESCE(?, id_type),
         id_number = COALESCE(?, id_number),
         date_of_birth = COALESCE(?, date_of_birth),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [first_name, last_name, email, phone, address, city, country, id_type, id_number, date_of_birth, guestId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update guest' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      
      res.json({ message: 'Guest updated successfully' });
    }
  );
});

// Delete guest
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const db = getDatabase();
  
  // Check if guest has active reservations
  db.get(
    'SELECT COUNT(*) as count FROM reservations WHERE guest_id = ? AND status IN ("confirmed", "checked_in")',
    [req.params.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ error: 'Cannot delete guest with active reservations' });
      }
      
      db.run('DELETE FROM guests WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete guest' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Guest not found' });
        }
        
        res.json({ message: 'Guest deleted successfully' });
      });
    }
  );
});

// Search guests by name or email
router.get('/search/:term', authenticateToken, (req, res) => {
  const searchTerm = `%${req.params.term}%`;
  const db = getDatabase();
  
  db.all(
    `SELECT id, first_name, last_name, email, phone 
     FROM guests 
     WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
     ORDER BY last_name, first_name
     LIMIT 20`,
    [searchTerm, searchTerm, searchTerm],
    (err, guests) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ guests });
    }
  );
});

module.exports = router;