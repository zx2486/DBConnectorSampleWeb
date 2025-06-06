
const express = require('express');
const healthRouter = express.Router();
const { performance } = require('perf_hooks');
const returnCode = require('../../simple-web/libs/returnCode');

const retentionPeriod = 1000 * 60 * 60 * 24 * 7; // 7 days in miniseconds


const calculateUserActivity = (cache, userId, timestamp) => {
  if (!cache || !userId || !timestamp) {
    console.error('Invalid parameters for calculateUserActivity');
    return;
  }
  console.log(`Recording activity for user ${userId} at ${new Date(timestamp).toISOString()}`);
  cache.zadd(`user:activity:${userId}`, timestamp, `activity:${timestamp}`).then(() => {
    const cutoffTime = timestamp - retentionPeriod;
    // Remove old data
    cache.zremrangebyscore(`user:activity:${userId}`, 0, cutoffTime).then(() => {
      // Count activities in the last 5 days
      cache.zcard(`user:activity:${userId}`).then(count => {
        cache.zadd('alluser:activity', count, userId).catch(err => {
          console.error('Error updating user activity count', err, userId);
        })
      }).catch(err => {
        console.error('Error counting user activities:', err, userId);
      });
    }).catch(err => {
      console.error('Error removing old activities:', err, userId);
    });
  }).catch(err => {
    console.error('Error recording user activity:', err, userId);
  });
}

const statisticsMiddleware = async (req, res, next) => {
  const start = performance.now();
  const method = req.method;
  const url = req.originalUrl || req.url;
  // log three things: count of request url, userId (if any), 
  // and url processing time (average and upper quartile)
  const cache = await req.app?.cache?.getPoolClient();
  if (cache) {
    res.on('finish', async () => {
      const duration = performance.now() - start;
      
      // Get current data for this URL
      cache.hgetall(`url:stats:${url}`).then(currentData => {
        // currentData = JSON.parse(currentData || '{}');
        let count = parseInt(currentData?.count || '0');
        let totalTime = parseFloat(currentData?.totalTime || '0');

        // Update counters
        count += 1;
        totalTime += duration;

        // Calculate new average
        const avgTime = totalTime / count;
        // Store updated stats in a hash
        cache.hmset(`url:stats:${url}`, {
          count,
          totalTime,
          avgTime
        });
        cache.zadd('url:processing:times', avgTime, url);
        cache.zadd('url:count', count, url);
        console.log(`${url} - Processing time: ${duration.toFixed(2)}ms, Avg: ${avgTime.toFixed(2)}ms`);
      }).catch(err => {
        console.error('Error updating URL stats:', err);
      });
    });
  }

  next();
}

const statisticsUserMiddleware = async (req, res, next) => {
  const cache = await req.app?.cache?.getPoolClient();
  console.log('statisticsUserMiddleware', req.userId, req.originalUrl, req.url);
  if (cache && req.userId) {
    const timestamp = Date.now();
    calculateUserActivity(cache, req.userId, timestamp);
  }
  next();
}

healthRouter.get('/status', async (req, res) => {
  try {
    // get the package version
    const packageJson = require('../../package.json');
    const returnObj = {
      version: packageJson.version || 'unknown',
      status: 'OK',
      db: false,
      cache: false
    }
    // Check database connection
    const db = req.app?.db;
    if (db) {
      try{
        const queryResult = await db.query({text: 'SELECT 1', values: []});
        if(queryResult && queryResult.count > 0) returnObj.db = true;
      }catch (e) {
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

const getStatistics = async (cache, key, limit) => {
  const stats = await cache.zrevrange(key, 0, limit - 1, 'WITHSCORES');
  const result = [];
  for (let i = 0; i < stats.length; i += 2) {
    result.push({
      item: stats[i],
      count: parseInt(stats[i + 1])
    });
  }

  return result;
}

healthRouter.get('/statistics/url', async (req, res) => {
  try {
    const cache = req.app?.cache;
    if (!cache) {
      throw new Error('Cache connection not available');
    }
    const result = {
      slowest: await getStatistics(cache, 'url:processing:times', parstInt(req.params?.limit || 10)),
      mostFrequent: await getStatistics(cache, 'url:count', parstInt(req.params?.limit || 10))
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
    const cache = req.app?.cache;
    if (!cache || !db) {
      throw new Error('Cache or db connection not available');
    }
    const timestamp = Date.now();
    const userIds = await db.select([{ table: 'users' }], ['id'],
      undefined, undefined, undefined, undefined, true
    );
    for (const user of userIds.rows) {
      const userId = user.id;
      calculateUserActivity(cache, userId, timestamp);
    }
    const activities = await getStatistics(cache, 'alluser:activity', parstInt(req.params?.limit || 20));
    res.status(200).json(activities);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: error.message });
  }
})

module.exports = {
  statisticsMiddleware,
  statisticsUserMiddleware,
  healthRouter
};
