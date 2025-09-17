const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { getDatabase, initializeDatabase } = require('../src/models/database');

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');
        
        // Ensure database is initialized
        await initializeDatabase();
        const db = getDatabase();
        
        // Check if data already exists
        db.get('SELECT COUNT(*) as count FROM users', async (err, result) => {
            if (err) {
                console.error('Error checking existing data:', err);
                return;
            }
            
            if (result.count > 0) {
                console.log('Database already contains data. Skipping seed.');
                process.exit(0);
            }
            
            // Seed users
            console.log('Seeding users...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            db.serialize(() => {
                // Insert users
                const userStmt = db.prepare(`
                    INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                userStmt.run('admin', 'admin@hotel.com', hashedPassword, 'admin', 'System', 'Administrator');
                userStmt.run('manager', 'manager@hotel.com', hashedPassword, 'manager', 'Hotel', 'Manager');
                userStmt.run('staff', 'staff@hotel.com', hashedPassword, 'staff', 'Front', 'Desk');
                userStmt.finalize();
                
                // Insert room types
                console.log('Seeding room types...');
                const roomTypeStmt = db.prepare(`
                    INSERT INTO room_types (name, description, base_price, capacity, amenities) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                roomTypeStmt.run('Standard Single', 'Comfortable single room with basic amenities', 89.99, 1, 
                    JSON.stringify(['WiFi', 'TV', 'Air Conditioning', 'Private Bathroom']));
                roomTypeStmt.run('Standard Double', 'Spacious double room perfect for couples', 129.99, 2, 
                    JSON.stringify(['WiFi', 'TV', 'Air Conditioning', 'Private Bathroom', 'Mini Fridge']));
                roomTypeStmt.run('Deluxe Suite', 'Luxurious suite with separate living area', 249.99, 4, 
                    JSON.stringify(['WiFi', 'TV', 'Air Conditioning', 'Private Bathroom', 'Mini Fridge', 'Balcony', 'Room Service']));
                roomTypeStmt.run('Presidential Suite', 'Ultimate luxury accommodation', 499.99, 6, 
                    JSON.stringify(['WiFi', 'TV', 'Air Conditioning', 'Private Bathroom', 'Mini Fridge', 'Balcony', 'Room Service', 'Jacuzzi', 'Butler Service']));
                roomTypeStmt.finalize();
                
                // Insert rooms
                console.log('Seeding rooms...');
                const roomStmt = db.prepare(`
                    INSERT INTO rooms (room_number, room_type_id, floor, status) 
                    VALUES (?, ?, ?, ?)
                `);
                
                // Floor 1 - Standard Singles
                for (let i = 101; i <= 110; i++) {
                    roomStmt.run(i.toString(), 1, 1, 'available');
                }
                
                // Floor 2 - Standard Doubles
                for (let i = 201; i <= 215; i++) {
                    roomStmt.run(i.toString(), 2, 2, 'available');
                }
                
                // Floor 3 - Deluxe Suites
                for (let i = 301; i <= 308; i++) {
                    roomStmt.run(i.toString(), 3, 3, 'available');
                }
                
                // Floor 4 - Presidential Suites
                for (let i = 401; i <= 404; i++) {
                    roomStmt.run(i.toString(), 4, 4, 'available');
                }
                
                // Make some rooms occupied for demo
                roomStmt.run('105', 1, 1, 'occupied');
                roomStmt.run('203', 2, 2, 'occupied');
                roomStmt.run('301', 3, 3, 'maintenance');
                roomStmt.finalize();
                
                // Insert sample guests
                console.log('Seeding guests...');
                const guestStmt = db.prepare(`
                    INSERT INTO guests (first_name, last_name, email, phone, address, city, country, id_type, id_number) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                guestStmt.run('John', 'Smith', 'john.smith@email.com', '+1-555-0101', '123 Main St', 'New York', 'USA', 'passport', 'P123456789');
                guestStmt.run('Emma', 'Johnson', 'emma.johnson@email.com', '+1-555-0102', '456 Oak Ave', 'Los Angeles', 'USA', 'driver_license', 'DL987654321');
                guestStmt.run('Michael', 'Brown', 'michael.brown@email.com', '+1-555-0103', '789 Pine Rd', 'Chicago', 'USA', 'passport', 'P987654321');
                guestStmt.run('Sarah', 'Davis', 'sarah.davis@email.com', '+1-555-0104', '321 Elm St', 'Houston', 'USA', 'driver_license', 'DL123456789');
                guestStmt.run('David', 'Wilson', 'david.wilson@email.com', '+1-555-0105', '654 Maple Dr', 'Phoenix', 'USA', 'passport', 'P456789123');
                guestStmt.finalize();
                
                // Insert sample reservations
                console.log('Seeding reservations...');
                const reservationStmt = db.prepare(`
                    INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, adults, children, status, total_amount, created_by) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);
                
                // Current reservations
                reservationStmt.run(1, 5, today.toISOString().split('T')[0], tomorrow.toISOString().split('T')[0], 1, 0, 'checked_in', 89.99, 1);
                reservationStmt.run(2, 18, today.toISOString().split('T')[0], nextWeek.toISOString().split('T')[0], 2, 0, 'checked_in', 909.93, 1);
                
                // Future reservations
                const futureDate = new Date(today);
                futureDate.setDate(futureDate.getDate() + 3);
                const futureEndDate = new Date(futureDate);
                futureEndDate.setDate(futureEndDate.getDate() + 2);
                
                reservationStmt.run(3, 2, futureDate.toISOString().split('T')[0], futureEndDate.toISOString().split('T')[0], 1, 0, 'confirmed', 179.98, 1);
                reservationStmt.run(4, 30, futureDate.toISOString().split('T')[0], futureEndDate.toISOString().split('T')[0], 2, 1, 'confirmed', 259.98, 1);
                reservationStmt.finalize();
                
                // Insert sample bills
                console.log('Seeding bills...');
                const billStmt = db.prepare(`
                    INSERT INTO bills (reservation_id, total_amount, paid_amount, status, payment_method) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                billStmt.run(1, 89.99, 89.99, 'paid', 'card');
                billStmt.run(2, 909.93, 500.00, 'partial', 'cash');
                billStmt.run(3, 179.98, 0, 'pending', null);
                billStmt.run(4, 259.98, 0, 'pending', null);
                billStmt.finalize();
                
                // Insert bill items
                console.log('Seeding bill items...');
                const billItemStmt = db.prepare(`
                    INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price, item_type) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                billItemStmt.run(1, 'Room 105 - 1 night', 1, 89.99, 89.99, 'room');
                billItemStmt.run(2, 'Room 203 - 7 nights', 7, 129.99, 909.93, 'room');
                billItemStmt.run(3, 'Room 102 - 2 nights', 2, 89.99, 179.98, 'room');
                billItemStmt.run(4, 'Room 301 - 2 nights', 2, 129.99, 259.98, 'room');
                billItemStmt.finalize();
                
                // Insert services
                console.log('Seeding services...');
                const serviceStmt = db.prepare(`
                    INSERT INTO services (name, description, price, category) 
                    VALUES (?, ?, ?, ?)
                `);
                
                serviceStmt.run('Room Service', 'In-room dining service', 15.00, 'food');
                serviceStmt.run('Laundry Service', 'Same-day laundry service', 25.00, 'laundry');
                serviceStmt.run('Airport Transfer', 'Round-trip airport transportation', 50.00, 'transport');
                serviceStmt.run('Spa Treatment', 'Full body massage and treatment', 120.00, 'spa');
                serviceStmt.run('Late Checkout', 'Checkout after 12:00 PM', 30.00, 'room');
                serviceStmt.run('Extra Bed', 'Additional bed in room', 40.00, 'room');
                serviceStmt.run('Mini Bar', 'Restocking mini bar', 20.00, 'food');
                serviceStmt.finalize();
                
                console.log('Database seeding completed successfully!');
                console.log('');
                console.log('Demo credentials:');
                console.log('Admin: admin / admin123');
                console.log('Manager: manager / admin123');
                console.log('Staff: staff / admin123');
                console.log('');
                console.log('The application is ready to use!');
                
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Run seeding
seedDatabase();