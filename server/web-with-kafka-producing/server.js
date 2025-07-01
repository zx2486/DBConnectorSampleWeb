require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Kafka } = require('kafkajs');
const postsRouter = require('../simple-web/controllers/posts');
const { openRouter: loginRouter, secureRouter: userRouter, extractJWT } = require('../simple-web/controllers/login');
const profileRouter = require('../simple-web/controllers/profile');
const {
  csrfProtection,
  setCsrfToken,
  handleCsrfError,
  idempotencyMiddleware,
  securityRouter
} = require('../web-with-redis/controllers/security');
const {
  statisticsMiddleware,
  statisticsUserMiddleware,
  healthRouter
} = require('./controllers/health');

const dbConnector = require('dbconnectortoolkit').default;
const IORedisClass = require('dbconnectortoolkit/dist/ioredisClass').default;
const KafkaClass = require('dbconnectortoolkit/dist/kafkaClass').default;

const masterDBConfig = {
  client: 'pg',
  endpoint: process.env.DB_ENDPOINT || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'mydatabase',
  //  logLevel: process.env.DB_LOG_LEVEL || 'error',
}
// Look at how similar to the simple-web server.js file, just add a config
const replicaDBConfig = [
  {
    client: 'pg',
    endpoint: process.env.DB_REPLICA_ENDPOINT || 'localhost',
    port: process.env.DB_REPLICA_PORT || 5432,
    username: process.env.DB_REPLICA_USER || 'user',
    password: process.env.DB_REPLICA_PASSWORD || 'password',
    database: process.env.DB_REPLICA_DATABASE || 'mydatabase',
    //  logLevel: process.env.DB_LOG_LEVEL || 'error',
    minConnection: 1,
    maxConnection: 10
  },
  {
    client: 'pg',
    endpoint: process.env.DB_REPLICA2_ENDPOINT || 'localhost',
    port: process.env.DB_REPLICA2_PORT || 5432,
    username: process.env.DB_REPLICA_USER || 'user',
    password: process.env.DB_REPLICA_PASSWORD || 'password',
    database: process.env.DB_REPLICA_DATABASE || 'mydatabase',
    //  logLevel: process.env.DB_LOG_LEVEL || 'error',
    minConnection: 1,
    maxConnection: 10
  },
]

const redisConfig = {
  client: 'ioredis',
  url: process.env.REDIS_URL || 'localhost:6379',
  // additionalNodeList:['localhost:7005', 'localhost:7006'],
  // cluster: true,
  cacheTTL: 60, // Cache TTL in seconds
  revalidate: 10 // Revalidate cache when cache will expire in 10 seconds
}

const kafkaConfig = {
  client: 'kafka',
  appName: process.env.KAFKA_APP_NAME || 'web-with-kafka-producing',
  brokerList: process.env.KAFKA_BROKER_LIST ?
    process.env.KAFKA_BROKER_LIST.split(',') :
    ['localhost:9092'],
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
// Wrap all routes in postsRouter with asyncHandler
const wrapRouter = (router) => {
  const wrappedRouter = express.Router();
  router.stack.forEach((layer) => {
    if (layer.route) {
      const routePath = layer.route.path;
      const routeMethods = layer.route.methods;
      /* Object.keys(routeMethods).forEach((method) => {
        wrappedRouter[method](routePath, asyncHandler(layer.route.stack[0].handle));
      });
      */

      Object.keys(routeMethods).forEach((method) => {
        const middlewares = layer.route.stack.map((middleware) =>
          asyncHandler(middleware.handle)
        );
        wrappedRouter[method](routePath, ...middlewares); // Spread all wrapped middlewares
      });

    }
  });
  return wrappedRouter;
};

const startServer = async () => {
  let db = null;
  let cache = null;
  let msgQueue = null;
  try {
    db = dbConnector(masterDBConfig, replicaDBConfig, redisConfig);
    await db.connect();
  } catch (e) {
    console.error('Error connecting to the database:', e);
  }

  try {
    cache = new IORedisClass({ ...redisConfig, cacheHeader: 'idempotencyStore' });
    await cache.connect();
  } catch (e) {
    console.error('Error connecting to the Redis cache:', e);
  }

  const msgTopics = {
    TOPIC_USER_ACTIVITY: 'user-activity',
    TOPIC_API_METRICS: 'api-metrics'
  };
  try {
    msgQueue = new KafkaClass(kafkaConfig);
    await msgQueue.connect();

    // Create topics if they don't exist, this should be done by a separate script or infra tools in production. Doing it here for simplicity.
    const kafka = new Kafka({
      clientId: kafkaConfig.appName,
      brokers: kafkaConfig.brokerList
    });
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [
        {
          topic: msgTopics.TOPIC_USER_ACTIVITY,
          numPartitions: 3,        // Split across 3 partitions
          replicationFactor: 1     // For development (use at least 2 in production)
        },
        {
          topic: msgTopics.TOPIC_API_METRICS,
          numPartitions: 3,
          replicationFactor: 1
        }
      ]
    });
    await admin.disconnect();
  } catch (e) {
    console.error('Error connecting to the Kafka message queue:', e);
  }

  const app = express();
  const port = process.env.SERVER_PORT || 4000;

  // Enable CORS for all routes
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3800',
    credentials: true
  }));
  app.use(cookieParser());
  // Parse JSON request bodies
  app.use(express.json());

  // Use the dbConnector middleware
  app.use((req, res, next) => {
    req.app = { db, cache, msgQueue, msgTopics };
    next();
  });

  app.use(statisticsMiddleware);

  // CSRF error handler
  app.use(handleCsrfError);

  app.use('/api/security',
    wrapRouter(securityRouter)
  )

  // API route
  app.use('/api/posts',
    csrfProtection, setCsrfToken,
    idempotencyMiddleware,
    wrapRouter(postsRouter)
  );

  app.use('/api/account',
    csrfProtection, setCsrfToken,
    idempotencyMiddleware,
    wrapRouter(loginRouter)
  );

  app.use('/api/profile',
    extractJWT,
    statisticsUserMiddleware,
    csrfProtection, setCsrfToken,
    idempotencyMiddleware,
    wrapRouter(profileRouter)
  );

  app.use('/api/user',
    extractJWT,
    statisticsUserMiddleware,
    csrfProtection, setCsrfToken,
    idempotencyMiddleware,
    wrapRouter(userRouter)
  );

  app.use('/api/health',
    wrapRouter(healthRouter)
  );

  app.use((err, req, res, next) => {
    console.error('Error:', err); // Log the error for debugging
    res.status(500).json({
      error: 'An unexpected error occurred',
      message: err?.message || '',
      detail: err?.detail || ''
    });
  });

  // The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
  app.get('*', (req, res) => {
    res.status(404).send('Not Found');
  });

  app.listen(port, () => {
    console.info(`Server is running at http://localhost:${port}`);
  });
};

// Start the server
startServer();