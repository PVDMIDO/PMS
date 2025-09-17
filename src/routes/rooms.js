const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all room types
router.get('/types', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all('SELECT * FROM room_types ORDER BY name', (err, roomTypes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Parse amenities JSON
    const typesWithAmenities = roomTypes.map(type => ({
      ...type,
      amenities: type.amenities ? JSON.parse(type.amenities) : []
    }));
    
    res.json({ roomTypes: typesWithAmenities });
  });
});

// Create room type
router.post('/types', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const { name, description, base_price, capacity, amenities } = req.body;
  
  if (!name || !base_price || !capacity) {
    return res.status(400).json({ error: 'Name, base price, and capacity are required' });
  }
  
  const db = getDatabase();
  
  db.run(
    `INSERT INTO room_types (name, description, base_price, capacity, amenities) 
     VALUES (?, ?, ?, ?, ?)`,
    [name, description, base_price, capacity, JSON.stringify(amenities || [])],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create room type' });
      }
      
      res.status(201).json({
        message: 'Room type created successfully',
        roomType: {
          id: this.lastID,
          name,
          description,
          base_price,
          capacity,
          amenities: amenities || []
        }
      });
    }
  );
});

// Get all rooms with type information
router.get('/', authenticateToken, (req, res) => {
  const { status, room_type_id, floor } = req.query;
  
  let query = `
    SELECT r.*, rt.name as type_name, rt.description as type_description, 
           rt.base_price, rt.capacity, rt.amenities
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }
  
  if (room_type_id) {
    query += ' AND r.room_type_id = ?';
    params.push(room_type_id);
  }
  
  if (floor) {
    query += ' AND r.floor = ?';
    params.push(floor);
  }
  
  query += ' ORDER BY r.room_number';
  
  const db = getDatabase();
  
  db.all(query, params, (err, rooms) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Parse amenities JSON
    const roomsWithAmenities = rooms.map(room => ({
      ...room,
      amenities: room.amenities ? JSON.parse(room.amenities) : []
    }));
    
    res.json({ rooms: roomsWithAmenities });
  });
});

// Get room by ID
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    `SELECT r.*, rt.name as type_name, rt.description as type_description, 
            rt.base_price, rt.capacity, rt.amenities
     FROM rooms r
     JOIN room_types rt ON r.room_type_id = rt.id
     WHERE r.id = ?`,
    [req.params.id],
    (err, room) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      room.amenities = room.amenities ? JSON.parse(room.amenities) : [];
      
      res.json({ room });
    }
  );
});

// Create new room
router.post('/', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const { room_number, room_type_id, floor, status = 'available', notes } = req.body;
  
  if (!room_number || !room_type_id) {
    return res.status(400).json({ error: 'Room number and room type are required' });
  }
  
  const db = getDatabase();
  
  db.run(
    `INSERT INTO rooms (room_number, room_type_id, floor, status, notes) 
     VALUES (?, ?, ?, ?, ?)`,
    [room_number, room_type_id, floor, status, notes],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Room number already exists' });
        }
        return res.status(500).json({ error: 'Failed to create room' });
      }
      
      res.status(201).json({
        message: 'Room created successfully',
        room: {
          id: this.lastID,
          room_number,
          room_type_id,
          floor,
          status,
          notes
        }
      });
    }
  );
});

// Update room
router.put('/:id', authenticateToken, authorizeRole(['admin', 'manager', 'staff']), (req, res) => {
  const { room_number, room_type_id, floor, status, notes } = req.body;
  const roomId = req.params.id;
  
  const db = getDatabase();
  
  db.run(
    `UPDATE rooms 
     SET room_number = COALESCE(?, room_number),
         room_type_id = COALESCE(?, room_type_id),
         floor = COALESCE(?, floor),
         status = COALESCE(?, status),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [room_number, room_type_id, floor, status, notes, roomId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Room number already exists' });
        }
        return res.status(500).json({ error: 'Failed to update room' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      res.json({ message: 'Room updated successfully' });
    }
  );
});

// Delete room
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const db = getDatabase();
  
  // Check if room has active reservations
  db.get(
    'SELECT COUNT(*) as count FROM reservations WHERE room_id = ? AND status IN ("confirmed", "checked_in")',
    [req.params.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ error: 'Cannot delete room with active reservations' });
      }
      
      db.run('DELETE FROM rooms WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete room' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Room not found' });
        }
        
        res.json({ message: 'Room deleted successfully' });
      });
    }
  );
});

module.exports = router;