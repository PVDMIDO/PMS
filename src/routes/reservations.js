const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all reservations
router.get('/', authenticateToken, (req, res) => {
  const { status, start_date, end_date, guest_id, room_id } = req.query;
  
  let query = `
    SELECT r.*, 
           g.first_name, g.last_name, g.email, g.phone,
           rm.room_number, rt.name as room_type_name, rt.base_price,
           u.username as created_by_username
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    JOIN room_types rt ON rm.room_type_id = rt.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }
  
  if (start_date) {
    query += ' AND r.check_out_date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND r.check_in_date <= ?';
    params.push(end_date);
  }
  
  if (guest_id) {
    query += ' AND r.guest_id = ?';
    params.push(guest_id);
  }
  
  if (room_id) {
    query += ' AND r.room_id = ?';
    params.push(room_id);
  }
  
  query += ' ORDER BY r.check_in_date DESC';
  
  const db = getDatabase();
  
  db.all(query, params, (err, reservations) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ reservations });
  });
});

// Get reservation by ID
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const query = `
    SELECT r.*, 
           g.first_name, g.last_name, g.email, g.phone, g.address, g.city, g.country,
           rm.room_number, rt.name as room_type_name, rt.base_price, rt.capacity,
           u.username as created_by_username
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    JOIN room_types rt ON rm.room_type_id = rt.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ?
  `;
  
  db.get(query, [req.params.id], (err, reservation) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json({ reservation });
  });
});

// Check room availability
router.get('/availability/:roomId', authenticateToken, (req, res) => {
  const { check_in, check_out } = req.query;
  const roomId = req.params.roomId;
  
  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Check-in and check-out dates are required' });
  }
  
  const db = getDatabase();
  
  const query = `
    SELECT COUNT(*) as count
    FROM reservations
    WHERE room_id = ? 
      AND status IN ('confirmed', 'checked_in')
      AND (
        (check_in_date <= ? AND check_out_date > ?) OR
        (check_in_date < ? AND check_out_date >= ?) OR
        (check_in_date >= ? AND check_out_date <= ?)
      )
  `;
  
  db.get(query, [roomId, check_in, check_in, check_out, check_out, check_in, check_out], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const available = result.count === 0;
    res.json({ available, roomId, check_in, check_out });
  });
});

// Get available rooms for a date range
router.get('/available-rooms', authenticateToken, (req, res) => {
  const { check_in, check_out, room_type_id } = req.query;
  
  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Check-in and check-out dates are required' });
  }
  
  let query = `
    SELECT r.*, rt.name as type_name, rt.base_price, rt.capacity
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE r.status = 'available'
      AND r.id NOT IN (
        SELECT room_id FROM reservations
        WHERE status IN ('confirmed', 'checked_in')
          AND (
            (check_in_date <= ? AND check_out_date > ?) OR
            (check_in_date < ? AND check_out_date >= ?) OR
            (check_in_date >= ? AND check_out_date <= ?)
          )
      )
  `;
  const params = [check_in, check_in, check_out, check_out, check_in, check_out];
  
  if (room_type_id) {
    query += ' AND r.room_type_id = ?';
    params.push(room_type_id);
  }
  
  query += ' ORDER BY r.room_number';
  
  const db = getDatabase();
  
  db.all(query, params, (err, rooms) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ rooms, check_in, check_out });
  });
});

// Create new reservation
router.post('/', authenticateToken, (req, res) => {
  const {
    guest_id,
    room_id,
    check_in_date,
    check_out_date,
    adults = 1,
    children = 0,
    notes
  } = req.body;
  
  if (!guest_id || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Guest, room, check-in and check-out dates are required' });
  }
  
  if (new Date(check_in_date) >= new Date(check_out_date)) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date' });
  }
  
  const db = getDatabase();
  
  // First check if room is available
  const availabilityQuery = `
    SELECT COUNT(*) as count
    FROM reservations
    WHERE room_id = ? 
      AND status IN ('confirmed', 'checked_in')
      AND (
        (check_in_date <= ? AND check_out_date > ?) OR
        (check_in_date < ? AND check_out_date >= ?) OR
        (check_in_date >= ? AND check_out_date <= ?)
      )
  `;
  
  db.get(availabilityQuery, [room_id, check_in_date, check_in_date, check_out_date, check_out_date, check_in_date, check_out_date], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ error: 'Room is not available for the selected dates' });
    }
    
    // Calculate total amount
    db.get('SELECT base_price FROM room_types rt JOIN rooms r ON rt.id = r.room_type_id WHERE r.id = ?', [room_id], (err, room) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!room) {
        return res.status(400).json({ error: 'Room not found' });
      }
      
      const nights = Math.ceil((new Date(check_out_date) - new Date(check_in_date)) / (1000 * 60 * 60 * 24));
      const total_amount = room.base_price * nights;
      
      // Create reservation
      db.run(
        `INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, adults, children, total_amount, notes, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [guest_id, room_id, check_in_date, check_out_date, adults, children, total_amount, notes, req.user.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create reservation' });
          }
          
          // Create initial bill
          db.run(
            'INSERT INTO bills (reservation_id, total_amount) VALUES (?, ?)',
            [this.lastID, total_amount],
            function(billErr) {
              if (billErr) {
                console.error('Failed to create bill:', billErr);
              }
              
              // Add room charge to bill items
              db.run(
                'INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price, item_type) VALUES (?, ?, ?, ?, ?, ?)',
                [this.lastID, `Room ${check_in_date} to ${check_out_date}`, nights, room.base_price, total_amount, 'room']
              );
            }
          );
          
          res.status(201).json({
            message: 'Reservation created successfully',
            reservation: {
              id: this.lastID,
              guest_id,
              room_id,
              check_in_date,
              check_out_date,
              adults,
              children,
              total_amount,
              notes,
              status: 'confirmed'
            }
          });
        }
      );
    });
  });
});

// Check-in guest
router.post('/:id/checkin', authenticateToken, (req, res) => {
  const reservationId = req.params.id;
  const checkInTime = new Date().toISOString();
  
  const db = getDatabase();
  
  db.run(
    `UPDATE reservations 
     SET status = 'checked_in', actual_check_in = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'confirmed'`,
    [checkInTime, reservationId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to check in guest' });
      }
      
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Reservation not found or already checked in' });
      }
      
      // Update room status to occupied
      db.run(
        `UPDATE rooms 
         SET status = 'occupied', updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT room_id FROM reservations WHERE id = ?)`,
        [reservationId]
      );
      
      res.json({ 
        message: 'Guest checked in successfully',
        checkInTime 
      });
    }
  );
});

// Check-out guest
router.post('/:id/checkout', authenticateToken, (req, res) => {
  const reservationId = req.params.id;
  const checkOutTime = new Date().toISOString();
  
  const db = getDatabase();
  
  db.run(
    `UPDATE reservations 
     SET status = 'checked_out', actual_check_out = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'checked_in'`,
    [checkOutTime, reservationId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to check out guest' });
      }
      
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Reservation not found or not checked in' });
      }
      
      // Update room status to cleaning
      db.run(
        `UPDATE rooms 
         SET status = 'cleaning', updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT room_id FROM reservations WHERE id = ?)`,
        [reservationId]
      );
      
      res.json({ 
        message: 'Guest checked out successfully',
        checkOutTime 
      });
    }
  );
});

// Cancel reservation
router.post('/:id/cancel', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const reservationId = req.params.id;
  const { reason } = req.body;
  
  const db = getDatabase();
  
  db.run(
    `UPDATE reservations 
     SET status = 'cancelled', notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status IN ('confirmed', 'checked_in')`,
    [reason, reservationId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to cancel reservation' });
      }
      
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Reservation not found or cannot be cancelled' });
      }
      
      res.json({ message: 'Reservation cancelled successfully' });
    }
  );
});

// Update reservation
router.put('/:id', authenticateToken, (req, res) => {
  const {
    check_in_date,
    check_out_date,
    adults,
    children,
    notes
  } = req.body;
  
  const reservationId = req.params.id;
  const db = getDatabase();
  
  db.run(
    `UPDATE reservations 
     SET check_in_date = COALESCE(?, check_in_date),
         check_out_date = COALESCE(?, check_out_date),
         adults = COALESCE(?, adults),
         children = COALESCE(?, children),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'confirmed'`,
    [check_in_date, check_out_date, adults, children, notes, reservationId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update reservation' });
      }
      
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Reservation not found or cannot be modified' });
      }
      
      res.json({ message: 'Reservation updated successfully' });
    }
  );
});

module.exports = router;