const csrf = require('csurf');
const crypto = require('crypto');
const express = require('express');
const securityRouter = express.Router();
const returnCode = require('../libs/returnCode');


// Use in-memory storage
const memoryIdempotencyStore = new Map();

// Configure CSRF protection
const csrfProtection = csrf({
  cookie: {
    key: '_csrf-token',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Middleware to set CSRF token in response
const setCsrfToken = (req, res, next) => {
  res.set('X-CSRF-Token', req.csrfToken());
  next();
};

// Generate idempotency key
const generateIdempotencyKey = () => {
  return crypto.randomUUID();
};

// Middleware to handle idempotency keys
const idempotencyMiddleware = async (req, res, next) => {
  // Only apply to POST, PUT, DELETE methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    const error = returnCode.IDEMPOTENCY_REQUIRED;
    return res.status(error.code).json({ error: error.message });
  }

  // Create a unique key that includes the user ID if available
  const userId = req.userId || 'anonymous';
  const uniqueKey = `idempotency:${userId}:${idempotencyKey}`;

  try {
    // Check if this key has been processed before
    let processedRequest = memoryIdempotencyStore.get(uniqueKey);

    if (processedRequest) {
      // Return the cached response
      return res.status(processedRequest.status).json(processedRequest.body);
    }
    // Prevent duplicate processing by initializing the store
    // Final result will be available after the response of the first call is sent
    const responseData = {
      status: 200,
      body: [],
      timestamp: new Date().toISOString()
    };
    memoryIdempotencyStore.set(uniqueKey, responseData);

    // Store the original response methods to intercept them
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;

    let responseBody;
    let responseStatus = 200;

    // Override status method
    res.status = function (code) {
      responseStatus = code;
      return originalStatus.call(this, code);
    };

    // Override json method
    res.json = function (body) {
      responseBody = body;

      // Store the response for future duplicate requests
      const responseData = {
        status: responseStatus,
        body: responseBody,
        timestamp: new Date().toISOString()
      };
      memoryIdempotencyStore.set(uniqueKey, responseData);

      return originalJson.call(this, body);
    };

    // Override send method for non-JSON responses
    res.send = function (body) {
      responseBody = body;

      const responseData = {
        status: responseStatus,
        body: responseBody,
        timestamp: new Date().toISOString()
      };
      memoryIdempotencyStore.set(uniqueKey, responseData);

      return originalSend.call(this, body);
    };

    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next(error);
  }
};

// Error handler for CSRF token validation failures
const handleCsrfError = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  const error = returnCode.CSRF_TOKEN_INVALID;
  return res.status(error.code).json({ error: error.message });
};

securityRouter.get('/csrf-token', csrfProtection, setCsrfToken, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

securityRouter.get('/idempotency-key', (req, res) => {
  const idempotencyKey = generateIdempotencyKey();
  res.json({ idempotencyKey });
});

module.exports = {
  csrfProtection,
  setCsrfToken,
  handleCsrfError,
  idempotencyMiddleware,
  generateIdempotencyKey,
  securityRouter
};