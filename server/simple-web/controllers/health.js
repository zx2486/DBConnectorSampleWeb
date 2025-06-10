
const express = require('express');
const healthRouter = express.Router();
const { performance } = require('perf_hooks');
const returnCode = require('../../simple-web/libs/returnCode');

const retentionPeriod = 1000 * 60 * 60 * 24 * 7; // 7 days in miniseconds

const statisticsMiddleware = async (req, res, next) => {
  const start = performance.now();
  const method = req.method;
  const url = req.originalUrl || req.url;
  // log three things: count of request url, userId (if any), 
  // and url processing time (average and upper quartile)
  const db = await req.app?.db;
  if (db) {
    res.on('finish', async () => {
      const duration = performance.now() - start;

      db.insert('activity_log', {
        method,
        url,
        processing_time: duration.toFixed(0),
      }).catch(err => {
        console.error('Error updating URL stats:', err);
      });
    });
  }

  next();
}

const statisticsUserMiddleware = async (req, res, next) => {
  const db = await req.app?.db;
  if (db && req.userId) {
    const timestamp = performance.now().toFixed(0);
    const method = req.method;
    const url = req.originalUrl || req.url;
    db.insert('activity_log', {
      method,
      url,
      user_id: req.userId,
      processing_time: timestamp,
    }).catch(err => {
      console.error('Error updating URL stats:', err);
    });
  }
  next();
}

healthRouter.get('/status', async (req, res) => {
  try {
    // get the package version
    const packageJson = require('../../../package.json');
    const returnObj = {
      version: packageJson.version || 'unknown',
      status: 'OK',
      db: false,
      cache: false
    }
    // Check database connection
    const db = req.app?.db;
    if (db) {
      try {
        const queryResult = await db.query({ text: 'SELECT 1', values: [] });
        if (queryResult && queryResult.count > 0) returnObj.db = true;
      } catch (e) {
        console.error('Database connection error:', e);
      }
    }

    // Check Redis cache connection
    const cache = req.app?.cache;
    if (cache) {
      const hashedCacheKey = Math.random().toString(36).substring(2)
      try {
        await cache.buildCache(
          { text: hashedCacheKey, values: [] },
          { rows: [{ id: hashedCacheKey }], count: 1, ttl: 2 },
          2
        );
        returnObj.cache = true;
        await cache.clearCache(
          { text: hashedCacheKey, values: [] }
        )
      } catch (e) {
        console.error('Cache connection error:', e);
      }
    }

    res.status(200).json(returnObj);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
})

healthRouter.get('/', async (req, res) => {
  res.status(returnCode.SUCCESS.code).send('OK');
})

const getStatistics = async (db, order, limit) => {
  const stats = await db.query({
    text: `SELECT 
        method,
        url,
        AVG(processing_time) as avg_processing_time,
        COUNT(*) as request_count
    FROM 
        activity_log
    WHERE user_id IS NULL
    GROUP BY 
        method, 
        url
    ORDER BY 
        ${order == 'count' ? 'request_count' : 'avg_processing_time'} DESC
    LIMIT $1`,
    values: [limit]
  })
  const result = [];
  for (let i = 0; i < stats?.rows?.length || 0; i += 1) {
    const item = stats?.rows[i]?.method + ' ' + stats?.rows[i]?.url;
    const count = (order == 'count')? stats?.rows[i]?.request_count : stats?.rows[i]?.avg_processing_time || 0;
    result.push({
      item: item,
      count: parseFloat(count).toFixed(6).replace(/\.?0+$/, '') || 0,
    });
  }
  return result;
}

getUserStatistics = async (db, limit) => {
  const stats = await db.query({
    text: `SELECT 
        user_id,
        COUNT(*) as request_count
    FROM 
        activity_log
    WHERE user_id IS NOT NULL
    GROUP BY 
        user_id
    ORDER BY 
        request_count DESC
    LIMIT $1`,
    values: [limit]
  });
  const result = [];
  for (let i = 0; i < stats?.rows?.length || 0; i += 1) {
    const userId = stats?.rows[i]?.user_id;
    const count = stats?.rows[i]?.request_count || 0;
    result.push({
      item: userId,
      count: parseFloat(count).toFixed(6).replace(/\.?0+$/, '') || 0,
    });
  }
  return result;
}

healthRouter.get('/statistics/url', async (req, res) => {
  try {
    const db = await req.app?.db;
    if (!db) {
      throw new Error('Cache connection not available');
    }
    const result = {
      slowest: await getStatistics(db, false, parseInt(req.query?.limit || 10)),
      mostFrequent: await getStatistics(db, 'count', parseInt(req.query?.limit || 10))
    };
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching slow URLs:', error);
    res.status(500).json({ error: error.message });
  }
})

healthRouter.get('/statistics/users', async (req, res) => {
  try {
    const db = req.app?.db;
    if (!db) {
      throw new Error('db connection not available');
    }
    const timestamp = Date.now();
    const userIds = await db.select([{ table: 'users' }], ['id', 'username'],
      undefined, undefined, undefined, undefined, true
    );
    for (const user of userIds.rows) {
      const userId = user.id;
      // delete all records older than retention period in activity_log where userId = userId
      await db.query({
        text: `DELETE FROM activity_log WHERE user_id = $1 AND created_at < NOW() - INTERVAL '${retentionPeriod} milliseconds'`,
        values: [userId]
      });
    }
    const activities = await getUserStatistics(db, parseInt(req.params?.limit || 20));
    // replace user id with username
    for (let i = 0; i < activities.length; i++) {
      const user = userIds.rows.find(u => u.id === parseInt(activities[i].item));
      if (user) {
        activities[i].item = user.username;
      }
    }
    res.status(200).json(activities);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: error.message });
  }
})

healthRouter.delete('/all', async (req, res) => {
  try {
    res.status(returnCode.INVALID_REQUEST.code).json({
      error: 'This endpoint is not implemented yet. Please check back later.'
    });
  } catch (error) {
    console.error('Error deleting all statistics:', error);
    res.status(500).json({ error: error.message });
  }
})

module.exports = {
  statisticsMiddleware,
  statisticsUserMiddleware,
  healthRouter
};
