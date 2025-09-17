// API utility functions for Hotel PMS

class API {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('token');
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    // Remove authentication token
    removeToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    // Get headers with authentication
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Generic API request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getProfile() {
        return this.request('/auth/profile');
    }

    // Dashboard methods
    async getDashboardStats() {
        return this.request('/dashboard/stats');
    }

    async getRecentReservations() {
        return this.request('/dashboard/recent-reservations');
    }

    async getOccupancyChart(days = 30) {
        return this.request(`/dashboard/occupancy-chart?days=${days}`);
    }

    async getRevenueChart(months = 12) {
        return this.request(`/dashboard/revenue-chart?months=${months}`);
    }

    async getRoomStatus() {
        return this.request('/dashboard/room-status');
    }

    // Room methods
    async getRooms(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/rooms?${params}`);
    }

    async getRoom(id) {
        return this.request(`/rooms/${id}`);
    }

    async createRoom(roomData) {
        return this.request('/rooms', {
            method: 'POST',
            body: JSON.stringify(roomData)
        });
    }

    async updateRoom(id, roomData) {
        return this.request(`/rooms/${id}`, {
            method: 'PUT',
            body: JSON.stringify(roomData)
        });
    }

    async deleteRoom(id) {
        return this.request(`/rooms/${id}`, {
            method: 'DELETE'
        });
    }

    async getRoomTypes() {
        return this.request('/rooms/types');
    }

    async createRoomType(typeData) {
        return this.request('/rooms/types', {
            method: 'POST',
            body: JSON.stringify(typeData)
        });
    }

    // Guest methods
    async getGuests(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/guests?${params}`);
    }

    async getGuest(id) {
        return this.request(`/guests/${id}`);
    }

    async createGuest(guestData) {
        return this.request('/guests', {
            method: 'POST',
            body: JSON.stringify(guestData)
        });
    }

    async updateGuest(id, guestData) {
        return this.request(`/guests/${id}`, {
            method: 'PUT',
            body: JSON.stringify(guestData)
        });
    }

    async deleteGuest(id) {
        return this.request(`/guests/${id}`, {
            method: 'DELETE'
        });
    }

    async searchGuests(term) {
        return this.request(`/guests/search/${encodeURIComponent(term)}`);
    }

    async getGuestReservations(id) {
        return this.request(`/guests/${id}/reservations`);
    }

    // Reservation methods
    async getReservations(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/reservations?${params}`);
    }

    async getReservation(id) {
        return this.request(`/reservations/${id}`);
    }

    async createReservation(reservationData) {
        return this.request('/reservations', {
            method: 'POST',
            body: JSON.stringify(reservationData)
        });
    }

    async updateReservation(id, reservationData) {
        return this.request(`/reservations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(reservationData)
        });
    }

    async checkIn(id) {
        return this.request(`/reservations/${id}/checkin`, {
            method: 'POST'
        });
    }

    async checkOut(id) {
        return this.request(`/reservations/${id}/checkout`, {
            method: 'POST'
        });
    }

    async cancelReservation(id, reason) {
        return this.request(`/reservations/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }

    async getAvailableRooms(checkIn, checkOut, roomTypeId = null) {
        const params = new URLSearchParams({
            check_in: checkIn,
            check_out: checkOut
        });
        if (roomTypeId) {
            params.append('room_type_id', roomTypeId);
        }
        return this.request(`/reservations/available-rooms?${params}`);
    }

    async checkRoomAvailability(roomId, checkIn, checkOut) {
        const params = new URLSearchParams({
            check_in: checkIn,
            check_out: checkOut
        });
        return this.request(`/reservations/availability/${roomId}?${params}`);
    }

    // Billing methods
    async getBills(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/billing?${params}`);
    }

    async getBill(id) {
        return this.request(`/billing/${id}`);
    }

    async addBillItem(billId, itemData) {
        return this.request(`/billing/${billId}/items`, {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    }

    async removeBillItem(billId, itemId) {
        return this.request(`/billing/${billId}/items/${itemId}`, {
            method: 'DELETE'
        });
    }

    async processPayment(billId, paymentData) {
        return this.request(`/billing/${billId}/payment`, {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async getServices() {
        return this.request('/billing/services');
    }

    async createService(serviceData) {
        return this.request('/billing/services', {
            method: 'POST',
            body: JSON.stringify(serviceData)
        });
    }

    async updateService(id, serviceData) {
        return this.request(`/billing/services/${id}`, {
            method: 'PUT',
            body: JSON.stringify(serviceData)
        });
    }
}

// Create global API instance
const api = new API();