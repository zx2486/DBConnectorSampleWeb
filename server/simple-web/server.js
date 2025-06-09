require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const postsRouter = require('./controllers/posts');
const { openRouter: loginRouter, secureRouter: userRouter, extractJWT } = require('./controllers/login');
const profileRouter = require('./controllers/profile');
const {
  csrfProtection,
  setCsrfToken,
  handleCsrfError,
  idempotencyMiddleware,
  securityRouter
} = require('./controllers/security');
const {
  statisticsMiddleware,
  statisticsUserMiddleware,
  healthRouter
} = require('./controllers/health');

const dbConnector = require('../../../DBConnectorToolkit/dist').default;
const masterDBConfig = {
  client: 'pg',
  endpoint: process.env.DB_ENDPOINT || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'mydatabase',
  //  logLevel: process.env.DB_LOG_LEVEL || 'error',
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
  try {
    db = dbConnector(masterDBConfig)
    await db.connect();
  } catch (e) {
    console.error('Error connecting to the database:', e);
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
    req.app = { db };
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