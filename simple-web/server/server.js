require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const postsRouter = require('./controllers/posts');
const { router: loginRouter, extractJWT } = require('./controllers/login');
const profileRouter = require('./controllers/profile');

const dbConnector = require('../../../DBConnectorToolkit/dist').default;
const masterDBConfig = {
  client: 'pg',
  endpoint: process.env.DB_ENDPOINT || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'postgres',
}

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
  app.use(cors());
  // Parse JSON request bodies
  app.use(express.json());

  // Use the dbConnector middleware
  app.use((req, res, next) => {
    req.app = {
      db
    };
    next();
  });

  // API route
  app.use('/api/posts',
    postsRouter
  );

  app.use('/api/login', loginRouter);

  app.use('/api/logout',
    extractJWT,
    (req, res) => {
      res.status(200).json({ success: true });
    }
  );

  app.use('/api/profile',
    extractJWT,
    profileRouter
  );

  app.use('/api/user',
    extractJWT,
    loginRouter
  );



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