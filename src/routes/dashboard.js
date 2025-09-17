const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  // Get current date
  const today = new Date().toISOString().split('T')[0];
  
  // Run multiple queries to get dashboard stats
  const queries = {
    totalRooms: 'SELECT COUNT(*) as count FROM rooms',
    availableRooms: 'SELECT COUNT(*) as count FROM rooms WHERE status = "available"',
    occupiedRooms: 'SELECT COUNT(*) as count FROM rooms WHERE status = "occupied"',
    maintenanceRooms: 'SELECT COUNT(*) as count FROM rooms WHERE status = "maintenance"',
    totalGuests: 'SELECT COUNT(*) as count FROM guests',
    todayCheckins: `SELECT COUNT(*) as count FROM reservations WHERE check_in_date = ? AND status = "confirmed"`,
    todayCheckouts: `SELECT COUNT(*) as count FROM reservations WHERE check_out_date = ? AND status = "checked_in"`,
    currentGuests: 'SELECT COUNT(*) as count FROM reservations WHERE status = "checked_in"',
    pendingBills: 'SELECT COUNT(*) as count FROM bills WHERE status IN ("pending", "partial")',
    totalRevenue: 'SELECT SUM(paid_amount) as total FROM bills WHERE status = "paid"',
    monthlyRevenue: `SELECT SUM(paid_amount) as total FROM bills WHERE status = "paid" AND strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')`
  };
  
  const stats = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;
  
  for (const [key, query] of Object.entries(queries)) {
    const params = [];
    if (key === 'todayCheckins' || key === 'todayCheckouts') {
      params.push(today);
    }
    
    db.get(query, params, (err, result) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        stats[key] = 0;
      } else {
        stats[key] = result.count || result.total || 0;
      }
      
      completedQueries++;
      if (completedQueries === totalQueries) {
        res.json({ stats });
      }
    });
  }
});

// Get recent reservations
router.get('/recent-reservations', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const query = `
    SELECT r.*, 
           g.first_name, g.last_name,
           rm.room_number, rt.name as room_type_name
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    JOIN room_types rt ON rm.room_type_id = rt.id
    ORDER BY r.created_at DESC
    LIMIT 10
  `;
  
  db.all(query, (err, reservations) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ reservations });
  });
});

// Get occupancy chart data
router.get('/occupancy-chart', authenticateToken, (req, res) => {
  const { days = 30 } = req.query;
  const db = getDatabase();
  
  const query = `
    WITH date_series AS (
      SELECT date('now', '-' || (ROW_NUMBER() OVER () - 1) || ' days') as date
      FROM (
        SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION
        SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION
        SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION
        SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION
        SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
      )
      LIMIT ?
    )
    SELECT 
      ds.date,
      COUNT(r.id) as occupied_rooms,
      (SELECT COUNT(*) FROM rooms) as total_rooms
    FROM date_series ds
    LEFT JOIN reservations r ON (
      ds.date >= r.check_in_date AND 
      ds.date < r.check_out_date AND 
      r.status IN ('confirmed', 'checked_in', 'checked_out')
    )
    GROUP BY ds.date
    ORDER BY ds.date DESC
  `;
  
  db.all(query, [days], (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const chartData = data.map(row => ({
      date: row.date,
      occupancy_rate: row.total_rooms > 0 ? (row.occupied_rooms / row.total_rooms * 100).toFixed(1) : 0,
      occupied_rooms: row.occupied_rooms,
      total_rooms: row.total_rooms
    }));
    
    res.json({ chartData });
  });
});

// Get revenue chart data
router.get('/revenue-chart', authenticateToken, (req, res) => {
  const { months = 12 } = req.query;
  const db = getDatabase();
  
  const query = `
    WITH month_series AS (
      SELECT 
        strftime('%Y-%m', date('now', 'start of month', '-' || (ROW_NUMBER() OVER () - 1) || ' months')) as month
      FROM (
        SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
        SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION
        SELECT 11 UNION SELECT 12
      )
      LIMIT ?
    )
    SELECT 
      ms.month,
      COALESCE(SUM(b.paid_amount), 0) as revenue
    FROM month_series ms
    LEFT JOIN bills b ON (
      strftime('%Y-%m', b.payment_date) = ms.month AND 
      b.status = 'paid'
    )
    GROUP BY ms.month
    ORDER BY ms.month DESC
  `;
  
  db.all(query, [months], (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ chartData: data });
  });
});

// Get room status overview
router.get('/room-status', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const query = `
    SELECT 
      rt.name as room_type,
      r.status,
      COUNT(*) as count
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    GROUP BY rt.name, r.status
    ORDER BY rt.name, r.status
  `;
  
  db.all(query, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Group by room type
    const grouped = {};
    data.forEach(row => {
      if (!grouped[row.room_type]) {
        grouped[row.room_type] = {};
      }
      grouped[row.room_type][row.status] = row.count;
    });
    
    res.json({ roomStatus: grouped });
  });
});

module.exports = router;