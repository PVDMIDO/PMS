// Main application logic for Hotel PMS

let currentUser = null;
let currentSection = 'dashboard';

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
});

// Check if user is authenticated
function checkAuthentication() {
    const token = localStorage.getItem('token');
    
    if (token) {
        api.setToken(token);
        loadUserProfile();
    } else {
        showLoginModal();
    }
}

// Load user profile
async function loadUserProfile() {
    try {
        const response = await api.getProfile();
        currentUser = response.user;
        
        document.getElementById('currentUser').textContent = 
            `${currentUser.first_name} ${currentUser.last_name}`;
        
        // Show main application
        document.getElementById('app').style.display = 'block';
        hideLoginModal();
        
        // Load dashboard by default
        showSection('dashboard');
        
    } catch (error) {
        console.error('Failed to load profile:', error);
        showLoginModal();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Navigation links
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            showSection(section);
            updateNavigation(section);
        });
    });
    
    // Filter listeners
    document.getElementById('reservationStatusFilter')?.addEventListener('change', loadReservations);
    document.getElementById('reservationDateFilter')?.addEventListener('change', loadReservations);
    document.getElementById('roomStatusFilter')?.addEventListener('change', loadRooms);
    
    // Search listener
    document.getElementById('guestSearch')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchGuests();
        }
    });
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await api.login(username, password);
        api.setToken(response.token);
        currentUser = response.user;
        
        loadUserProfile();
        showSuccess('Login successful!');
        
    } catch (error) {
        showError(error.message || 'Login failed');
    }
}

// Logout
function logout() {
    api.removeToken();
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    showLoginModal();
}

// Show/hide login modal
function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

function hideLoginModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (modal) {
        modal.hide();
    }
}

// Show specific section
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(`${section}-section`).style.display = 'block';
    currentSection = section;
    
    // Load section data
    loadSectionData(section);
    updateNavigation(section);
}

// Update navigation active state
function updateNavigation(section) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
}

// Load data for specific section
async function loadSectionData(section) {
    try {
        switch (section) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'reservations':
                await loadReservations();
                break;
            case 'rooms':
                await loadRooms();
                break;
            case 'guests':
                await loadGuests();
                break;
            case 'billing':
                await loadBills();
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${section} data:`, error);
        showError(`Failed to load ${section} data`);
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        const [statsResponse, reservationsResponse] = await Promise.all([
            api.getDashboardStats(),
            api.getRecentReservations()
        ]);
        
        // Update statistics
        const stats = statsResponse.stats;
        document.getElementById('totalRooms').textContent = stats.totalRooms || 0;
        document.getElementById('availableRooms').textContent = stats.availableRooms || 0;
        document.getElementById('occupiedRooms').textContent = stats.occupiedRooms || 0;
        document.getElementById('currentGuests').textContent = stats.currentGuests || 0;
        
        // Update recent reservations
        updateRecentReservationsTable(reservationsResponse.reservations);
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// Update recent reservations table
function updateRecentReservationsTable(reservations) {
    const tbody = document.getElementById('recentReservations');
    tbody.innerHTML = '';
    
    reservations.slice(0, 10).forEach(reservation => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reservation.first_name} ${reservation.last_name}</td>
            <td>${reservation.room_number}</td>
            <td>${formatDate(reservation.check_in_date)}</td>
            <td><span class="badge status-${reservation.status}">${formatStatus(reservation.status)}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Load reservations
async function loadReservations() {
    try {
        const filters = {};
        
        const statusFilter = document.getElementById('reservationStatusFilter')?.value;
        const dateFilter = document.getElementById('reservationDateFilter')?.value;
        
        if (statusFilter) filters.status = statusFilter;
        if (dateFilter) filters.start_date = dateFilter;
        
        const response = await api.getReservations(filters);
        updateReservationsTable(response.reservations);
        
    } catch (error) {
        console.error('Failed to load reservations:', error);
        showError('Failed to load reservations');
    }
}

// Update reservations table
function updateReservationsTable(reservations) {
    const tbody = document.getElementById('reservationsTable');
    tbody.innerHTML = '';
    
    reservations.forEach(reservation => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reservation.id}</td>
            <td>${reservation.first_name} ${reservation.last_name}</td>
            <td>${reservation.room_number}</td>
            <td>${formatDate(reservation.check_in_date)}</td>
            <td>${formatDate(reservation.check_out_date)}</td>
            <td><span class="badge status-${reservation.status}">${formatStatus(reservation.status)}</span></td>
            <td>$${parseFloat(reservation.total_amount || 0).toFixed(2)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    ${getReservationActions(reservation)}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Get reservation action buttons
function getReservationActions(reservation) {
    let actions = '';
    
    if (reservation.status === 'confirmed') {
        actions += `<button class="btn btn-success btn-sm" onclick="checkInGuest(${reservation.id})">
            <i class="fas fa-sign-in-alt"></i> Check In
        </button>`;
    }
    
    if (reservation.status === 'checked_in') {
        actions += `<button class="btn btn-warning btn-sm" onclick="checkOutGuest(${reservation.id})">
            <i class="fas fa-sign-out-alt"></i> Check Out
        </button>`;
    }
    
    actions += `<button class="btn btn-info btn-sm" onclick="viewReservation(${reservation.id})">
        <i class="fas fa-eye"></i>
    </button>`;
    
    return actions;
}

// Load rooms
async function loadRooms() {
    try {
        const filters = {};
        const statusFilter = document.getElementById('roomStatusFilter')?.value;
        if (statusFilter) filters.status = statusFilter;
        
        const response = await api.getRooms(filters);
        updateRoomsGrid(response.rooms);
        
    } catch (error) {
        console.error('Failed to load rooms:', error);
        showError('Failed to load rooms');
    }
}

// Update rooms grid
function updateRoomsGrid(rooms) {
    const grid = document.getElementById('roomsGrid');
    grid.innerHTML = '';
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'col-md-4 col-lg-3 mb-3';
        roomCard.innerHTML = `
            <div class="card room-card room-${room.status}" onclick="viewRoom(${room.id})">
                <div class="card-body">
                    <h5 class="card-title">Room ${room.room_number}</h5>
                    <p class="card-text">
                        <strong>Type:</strong> ${room.type_name}<br>
                        <strong>Floor:</strong> ${room.floor || 'N/A'}<br>
                        <strong>Price:</strong> $${parseFloat(room.base_price).toFixed(2)}/night
                    </p>
                    <span class="badge bg-${getStatusColor(room.status)}">${formatStatus(room.status)}</span>
                </div>
            </div>
        `;
        grid.appendChild(roomCard);
    });
}

// Load guests
async function loadGuests() {
    try {
        const response = await api.getGuests();
        updateGuestsTable(response.guests);
        
    } catch (error) {
        console.error('Failed to load guests:', error);
        showError('Failed to load guests');
    }
}

// Update guests table
function updateGuestsTable(guests) {
    const tbody = document.getElementById('guestsTable');
    tbody.innerHTML = '';
    
    guests.forEach(guest => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${guest.id}</td>
            <td>${guest.first_name} ${guest.last_name}</td>
            <td>${guest.email || 'N/A'}</td>
            <td>${guest.phone || 'N/A'}</td>
            <td>${guest.city || 'N/A'}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-info btn-sm" onclick="viewGuest(${guest.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="editGuest(${guest.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search guests
async function searchGuests() {
    const searchTerm = document.getElementById('guestSearch').value.trim();
    
    if (searchTerm.length < 2) {
        loadGuests();
        return;
    }
    
    try {
        const response = await api.searchGuests(searchTerm);
        updateGuestsTable(response.guests);
    } catch (error) {
        console.error('Failed to search guests:', error);
        showError('Failed to search guests');
    }
}

// Load bills
async function loadBills() {
    try {
        const response = await api.getBills();
        updateBillsTable(response.bills);
        
    } catch (error) {
        console.error('Failed to load bills:', error);
        showError('Failed to load bills');
    }
}

// Update bills table
function updateBillsTable(bills) {
    const tbody = document.getElementById('billsTable');
    tbody.innerHTML = '';
    
    bills.forEach(bill => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${bill.id}</td>
            <td>${bill.first_name} ${bill.last_name}</td>
            <td>${bill.room_number}</td>
            <td>$${parseFloat(bill.total_amount).toFixed(2)}</td>
            <td>$${parseFloat(bill.paid_amount || 0).toFixed(2)}</td>
            <td><span class="badge status-${bill.status}">${formatStatus(bill.status)}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-info btn-sm" onclick="viewBill(${bill.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${bill.status !== 'paid' ? `
                        <button class="btn btn-success btn-sm" onclick="processPayment(${bill.id})">
                            <i class="fas fa-credit-card"></i> Pay
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Action functions
async function checkInGuest(reservationId) {
    try {
        await api.checkIn(reservationId);
        showSuccess('Guest checked in successfully');
        loadReservations();
        loadDashboard();
    } catch (error) {
        showError(error.message);
    }
}

async function checkOutGuest(reservationId) {
    try {
        await api.checkOut(reservationId);
        showSuccess('Guest checked out successfully');
        loadReservations();
        loadDashboard();
    } catch (error) {
        showError(error.message);
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatStatus(status) {
    return status.replace('_', ' ').toUpperCase();
}

function getStatusColor(status) {
    const colors = {
        'available': 'success',
        'occupied': 'danger',
        'maintenance': 'warning',
        'cleaning': 'info',
        'confirmed': 'success',
        'checked_in': 'primary',
        'checked_out': 'secondary',
        'cancelled': 'danger',
        'pending': 'warning',
        'partial': 'warning',
        'paid': 'success'
    };
    return colors[status] || 'secondary';
}

// Show success/error messages
function showSuccess(message) {
    // You can implement a toast or alert system here
    console.log('Success:', message);
    alert(message); // Temporary implementation
}

function showError(message) {
    // You can implement a toast or alert system here
    console.error('Error:', message);
    alert('Error: ' + message); // Temporary implementation
}

// Placeholder functions for modal operations
function showNewReservationModal() {
    alert('New Reservation Modal - To be implemented');
}

function showNewGuestModal() {
    alert('New Guest Modal - To be implemented');
}

function showNewRoomModal() {
    alert('New Room Modal - To be implemented');
}

function showRoomTypesModal() {
    alert('Room Types Modal - To be implemented');
}

function viewReservation(id) {
    alert(`View Reservation ${id} - To be implemented`);
}

function viewRoom(id) {
    alert(`View Room ${id} - To be implemented`);
}

function viewGuest(id) {
    alert(`View Guest ${id} - To be implemented`);
}

function editGuest(id) {
    alert(`Edit Guest ${id} - To be implemented`);
}

function viewBill(id) {
    alert(`View Bill ${id} - To be implemented`);
}

function processPayment(id) {
    alert(`Process Payment for Bill ${id} - To be implemented`);
}