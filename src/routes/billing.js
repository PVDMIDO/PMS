const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all bills
router.get('/', authenticateToken, (req, res) => {
  const { status, reservation_id } = req.query;
  
  let query = `
    SELECT b.*, 
           r.id as reservation_id, r.check_in_date, r.check_out_date,
           g.first_name, g.last_name, g.email,
           rm.room_number, rt.name as room_type_name
    FROM bills b
    JOIN reservations r ON b.reservation_id = r.id
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    JOIN room_types rt ON rm.room_type_id = rt.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  
  if (reservation_id) {
    query += ' AND b.reservation_id = ?';
    params.push(reservation_id);
  }
  
  query += ' ORDER BY b.created_at DESC';
  
  const db = getDatabase();
  
  db.all(query, params, (err, bills) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ bills });
  });
});

// Get bill by ID with items
router.get('/:id', authenticateToken, (req, res) => {
  const billId = req.params.id;
  const db = getDatabase();
  
  // Get bill details
  const billQuery = `
    SELECT b.*, 
           r.id as reservation_id, r.check_in_date, r.check_out_date, r.adults, r.children,
           g.first_name, g.last_name, g.email, g.phone, g.address,
           rm.room_number, rt.name as room_type_name, rt.base_price
    FROM bills b
    JOIN reservations r ON b.reservation_id = r.id
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    JOIN room_types rt ON rm.room_type_id = rt.id
    WHERE b.id = ?
  `;
  
  db.get(billQuery, [billId], (err, bill) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    // Get bill items
    db.all('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY created_at', [billId], (err, items) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      bill.items = items;
      res.json({ bill });
    });
  });
});

// Add item to bill
router.post('/:id/items', authenticateToken, (req, res) => {
  const billId = req.params.id;
  const { description, quantity = 1, unit_price, item_type = 'service' } = req.body;
  
  if (!description || !unit_price) {
    return res.status(400).json({ error: 'Description and unit price are required' });
  }
  
  const total_price = quantity * unit_price;
  const db = getDatabase();
  
  // Add item to bill
  db.run(
    'INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price, item_type) VALUES (?, ?, ?, ?, ?, ?)',
    [billId, description, quantity, unit_price, total_price, item_type],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add item to bill' });
      }
      
      // Update bill total
      db.run(
        `UPDATE bills 
         SET total_amount = (
           SELECT SUM(total_price) FROM bill_items WHERE bill_id = ?
         ), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [billId, billId],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Failed to update bill total' });
          }
          
          res.status(201).json({
            message: 'Item added to bill successfully',
            item: {
              id: this.lastID,
              bill_id: billId,
              description,
              quantity,
              unit_price,
              total_price,
              item_type
            }
          });
        }
      );
    }
  );
});

// Remove item from bill
router.delete('/:id/items/:itemId', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const { id: billId, itemId } = req.params;
  const db = getDatabase();
  
  db.run('DELETE FROM bill_items WHERE id = ? AND bill_id = ?', [itemId, billId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to remove item from bill' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Update bill total
    db.run(
      `UPDATE bills 
       SET total_amount = (
         SELECT COALESCE(SUM(total_price), 0) FROM bill_items WHERE bill_id = ?
       ), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [billId, billId],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update bill total' });
        }
        
        res.json({ message: 'Item removed from bill successfully' });
      }
    );
  });
});

// Process payment
router.post('/:id/payment', authenticateToken, (req, res) => {
  const billId = req.params.id;
  const { amount, payment_method = 'cash' } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }
  
  const db = getDatabase();
  
  // Get current bill info
  db.get('SELECT * FROM bills WHERE id = ?', [billId], (err, bill) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    const newPaidAmount = (bill.paid_amount || 0) + parseFloat(amount);
    let newStatus = 'pending';
    
    if (newPaidAmount >= bill.total_amount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }
    
    const paymentDate = newStatus === 'paid' ? new Date().toISOString() : bill.payment_date;
    
    db.run(
      `UPDATE bills 
       SET paid_amount = ?, 
           status = ?, 
           payment_method = ?,
           payment_date = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newPaidAmount, newStatus, payment_method, paymentDate, billId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to process payment' });
        }
        
        res.json({
          message: 'Payment processed successfully',
          payment: {
            amount: parseFloat(amount),
            payment_method,
            new_paid_amount: newPaidAmount,
            remaining_balance: bill.total_amount - newPaidAmount,
            status: newStatus
          }
        });
      }
    );
  });
});

// Get services for billing
router.get('/services', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all('SELECT * FROM services WHERE active = 1 ORDER BY category, name', (err, services) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ services });
  });
});

// Create service
router.post('/services', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const { name, description, price, category } = req.body;
  
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price, and category are required' });
  }
  
  const db = getDatabase();
  
  db.run(
    'INSERT INTO services (name, description, price, category) VALUES (?, ?, ?, ?)',
    [name, description, price, category],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create service' });
      }
      
      res.status(201).json({
        message: 'Service created successfully',
        service: {
          id: this.lastID,
          name,
          description,
          price,
          category
        }
      });
    }
  );
});

// Update service
router.put('/services/:id', authenticateToken, authorizeRole(['admin', 'manager']), (req, res) => {
  const { name, description, price, category, active } = req.body;
  const serviceId = req.params.id;
  
  const db = getDatabase();
  
  db.run(
    `UPDATE services 
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         price = COALESCE(?, price),
         category = COALESCE(?, category),
         active = COALESCE(?, active)
     WHERE id = ?`,
    [name, description, price, category, active, serviceId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update service' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      res.json({ message: 'Service updated successfully' });
    }
  );
});

module.exports = router;