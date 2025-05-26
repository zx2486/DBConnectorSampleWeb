// services/api.js

class ApiService {
  constructor(_apiUrl) {
    this.API_URL = _apiUrl;
    this.csrfToken = null;
    this.idempotencyKeys = new Map();
  }

  // Fetch CSRF token
  async getCsrfToken() {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch(`${this.API_URL}/api/security/csrf-token`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }

      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      throw error;
    }
  }

  // Get idempotency key for an endpoint
  async getIdempotencyKey(endpoint) {
    try {
      // First check if we have a cached key
      if (this.idempotencyKeys.has(endpoint)) {
        return this.idempotencyKeys.get(endpoint);
      }

      const response = await fetch(`${this.API_URL}/api/security/idempotency-key`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch idempotency key');
      }

      const data = await response.json();
      const key = data.idempotencyKey;

      // Store the key for this endpoint
      this.idempotencyKeys.set(endpoint, key);
      return key;
    } catch (error) {
      console.error('Error fetching idempotency key:', error);
      throw error;
    }
  }

  // Perform API request with CSRF and idempotency
  async request(method, endpoint, reqHeaders = {}, data = null) {
    try {
      const csrfToken = await this.getCsrfToken();
      let idempotencyKey = null;

      // For POST, PUT, DELETE operations, get an idempotency key
      if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        idempotencyKey = await this.getIdempotencyKey(endpoint);
      }

      const headers = {
        ...reqHeaders,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      };

      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const options = {
        method,
        headers,
        credentials: 'include',
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.API_URL}${endpoint}`, options);

      // Clear idempotency key on successful completion
      if (response.ok && idempotencyKey) {
        // Remove the used key
        this.idempotencyKeys.delete(endpoint);
      }

      const responseData = await response.json();
      return { status: response.status, data: responseData };
    } catch (error) {
      console.error(`API error (${method} ${endpoint}):`, error);
      throw error;
    }
  }

  // Helper methods for common HTTP methods
  async get(endpoint, headers = {}) {
    return this.request('GET', endpoint, headers);
  }

  async post(endpoint, headers = {}, data) {
    return this.request('POST', endpoint, headers, data);
  }

  async put(endpoint, headers = {}, data) {
    return this.request('PUT', endpoint, headers, data);
  }

  async delete(endpoint, headers = {}) {
    return this.request('DELETE', endpoint, headers);
  }
}

export default ApiService;