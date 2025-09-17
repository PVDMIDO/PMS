# Hotel Properties Management System (PMS)

A comprehensive web-based hotel management system built with Node.js, Express, SQLite, and vanilla JavaScript. This system provides all the essential features needed to manage a hotel's operations including room management, guest registration, reservations, check-in/check-out, billing, and reporting.

## Features

### 🏨 Core Hotel Management
- **Room Management**: Manage room inventory, types, pricing, and status
- **Guest Management**: Register guests, maintain guest profiles and history
- **Reservation System**: Handle bookings, check-ins, check-outs, and cancellations
- **Billing & Payments**: Process payments, generate bills, and track revenue
- **Dashboard**: Real-time statistics and operational overview

### 🔐 Security & Access Control
- **User Authentication**: Secure login system with JWT tokens
- **Role-based Access**: Admin, Manager, and Staff roles with different permissions
- **Password Encryption**: Secure password hashing with bcrypt

### 📊 Reporting & Analytics
- **Dashboard Statistics**: Real-time occupancy rates, revenue, and guest counts
- **Room Status Overview**: Visual representation of room availability
- **Revenue Tracking**: Monthly and daily revenue reports
- **Occupancy Charts**: Historical occupancy data and trends

## Technology Stack

- **Backend**: Node.js with Express.js framework
- **Database**: SQLite for data persistence
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet.js, CORS, Rate limiting
- **Styling**: Bootstrap 5 (CDN), Font Awesome icons

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-reservations` - Get recent reservations
- `GET /api/dashboard/occupancy-chart` - Get occupancy data
- `GET /api/dashboard/revenue-chart` - Get revenue data

### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get specific room
- `POST /api/rooms` - Create new room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room
- `GET /api/rooms/types` - Get room types
- `POST /api/rooms/types` - Create room type

### Guests
- `GET /api/guests` - Get all guests
- `GET /api/guests/:id` - Get specific guest
- `POST /api/guests` - Create new guest
- `PUT /api/guests/:id` - Update guest
- `DELETE /api/guests/:id` - Delete guest
- `GET /api/guests/search/:term` - Search guests

### Reservations
- `GET /api/reservations` - Get all reservations
- `GET /api/reservations/:id` - Get specific reservation
- `POST /api/reservations` - Create new reservation
- `PUT /api/reservations/:id` - Update reservation
- `POST /api/reservations/:id/checkin` - Check-in guest
- `POST /api/reservations/:id/checkout` - Check-out guest
- `POST /api/reservations/:id/cancel` - Cancel reservation
- `GET /api/reservations/available-rooms` - Get available rooms

### Billing
- `GET /api/billing` - Get all bills
- `GET /api/billing/:id` - Get specific bill
- `POST /api/billing/:id/items` - Add item to bill
- `DELETE /api/billing/:id/items/:itemId` - Remove item from bill
- `POST /api/billing/:id/payment` - Process payment
- `GET /api/billing/services` - Get available services

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PMS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database with sample data**
   ```bash
   npm run seed
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

### Demo Credentials

The system comes with pre-configured demo accounts:

- **Administrator**: `admin` / `admin123`
- **Manager**: `manager` / `admin123`
- **Staff**: `staff` / `admin123`

## Project Structure

```
PMS/
├── server.js                 # Main server file
├── package.json             # Dependencies and scripts
├── src/
│   ├── controllers/         # Business logic controllers
│   ├── models/
│   │   └── database.js      # Database configuration and schema
│   ├── routes/              # API route definitions
│   │   ├── auth.js          # Authentication routes
│   │   ├── rooms.js         # Room management routes
│   │   ├── guests.js        # Guest management routes
│   │   ├── reservations.js  # Reservation routes
│   │   ├── billing.js       # Billing and payment routes
│   │   └── dashboard.js     # Dashboard and analytics routes
│   ├── middleware/
│   │   └── auth.js          # Authentication middleware
│   └── utils/               # Utility functions
├── public/                  # Frontend static files
│   ├── index.html           # Main application HTML
│   ├── css/
│   │   └── style.css        # Custom styles
│   └── js/
│       ├── api.js           # API client functions
│       ├── app.js           # Main application logic
│       └── modals.js        # Modal functionality
├── database/
│   └── hotel.db             # SQLite database file
└── scripts/
    └── seedDatabase.js      # Database seeding script
```

## Database Schema

The system uses SQLite with the following main tables:

- **users**: System users with role-based access
- **room_types**: Different categories of rooms (Standard, Deluxe, Suite, etc.)
- **rooms**: Individual room inventory
- **guests**: Guest profiles and information
- **reservations**: Booking and stay records
- **bills**: Billing information for reservations
- **bill_items**: Detailed billing line items
- **services**: Additional services offered by the hotel

## Usage Examples

### Creating a New Reservation

```javascript
// Example API call to create a reservation
const reservationData = {
  guest_id: 1,
  room_id: 101,
  check_in_date: "2025-01-15",
  check_out_date: "2025-01-18",
  adults: 2,
  children: 0,
  notes: "Guest requested late check-in"
};

fetch('/api/reservations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify(reservationData)
});
```

### Checking Room Availability

```javascript
// Check if rooms are available for specific dates
fetch('/api/reservations/available-rooms?check_in=2025-01-15&check_out=2025-01-18', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
})
.then(response => response.json())
.then(data => console.log('Available rooms:', data.rooms));
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This will start the server with nodemon for automatic restarts on file changes.

### Testing the API

You can test the API endpoints using curl:

```bash
# Login to get a token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Get dashboard stats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/dashboard/stats

# Get all rooms
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/rooms
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please create an issue in the repository or contact the development team.

---

**Hotel PMS** - Complete hotel management solution for modern hospitality businesses.