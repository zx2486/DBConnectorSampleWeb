
const express = require('express');
const healthRouter = express.Router();
const returnCode = require('../../simple-web/libs/returnCode');

const statisticsMiddleware = (req, res, next) => {
  const start = Date.now();
  // log three things: count of request url (KTop), userId (if any) (KTop), 
  // and url processing time (average and upper quartile)
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`Request to ${req.method} ${req.originalUrl} took ${duration}ms`);
  });
  next();
}

const status = async (req, res) => {
  try {
    // get the package version
    const packageJson = require('../../package.json');
    const version = packageJson.version || 'unknown';
    // Check database connection
    const db = req.app?.db;
    if (db) {
      await db.query('SELECT 1');
    } else {
      throw new Error('Database connection not available');
    }

    // Check Redis cache connection
    const cache = req.app?.cache;
    if (cache) {
      await cache.ping();
    } else {
      throw new Error('Redis cache connection not available');
    }

    res.status(200).json({ version, status: 'healthy' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
}

const health = async (req,res) =>{
    res.status(returnCode.OK.code).send('OK');
}
