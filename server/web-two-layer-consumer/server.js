require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const { Kafka } = require('kafkajs');


const dbConnector = require('../../../DBConnectorToolkit/dist').default;
const KafkaClass = require('../../../DBConnectorToolkit/dist/kafkaClass').default;

// We are using slave DB as this server is client facing and should not touch master
// But all the writes will go to kafka.
// Look at how little you need to change from simple client server to multi-layer backend
const masterDBConfig = {
  client: 'pg',
  endpoint: process.env.DB_ENDPOINT || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'mydatabase',
  //  logLevel: process.env.DB_LOG_LEVEL || 'error',
}

const kafkaConfig = {
  client: 'kafka',
  appName: process.env.KAFKA_APP_NAME || 'web-two-layer',
  brokerList: process.env.KAFKA_BROKER_LIST ?
    process.env.KAFKA_BROKER_LIST.split(',') :
    ['localhost:9092'],
  dbtopic: process.env.KAFKA_WRITING_DB_TOPIC || 'writing_db_topic',
  groupId: process.env.KAFKA_GROUP_ID || 'web-two-layer-consumer-group',
}

let processedCount = 0;
let errorCount = 0;
let msgQueue = null;
const startServer = async () => {
  let db = null;
  try {
    db = dbConnector(masterDBConfig);
    await db.connect();
  } catch (e) {
    console.error('Error connecting to the database:', e);
  }

  try {
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
          topic: kafkaConfig.dbtopic, // Topic for writing to the database
          numPartitions: 3,        // Split across 3 partitions
          replicationFactor: 1     // For development (use at least 2 in production)
        },
        {
          topic: `${kafkaConfig.dbtopic}-dlq`, // Topic for deal letter queue, no consumer for this anyway
          numPartitions: 3,        // Split across 3 partitions
          replicationFactor: 1     // For development (use at least 2 in production)
        },
      ]
    });
    await admin.disconnect();

    // Initialize Kafka message queue
    msgQueue = new KafkaClass(kafkaConfig);
    await msgQueue.connect(false);
    await msgQueue.connect(true); // For the deal letter queue
    msgQueue.subscribe([{
      topic: kafkaConfig.dbtopic,
      callback: async (message) => {
        try {
          /*topic: dbTopic,
              message: JSON.stringify(_query),
              key: crypto.randomUUID(),
          */
          const msgContent = JSON.parse(message.message);
          const msgKey = message.key || false;
          let ingressionTs = message.ingressionTs || Date.now();
          if (!msgKey || !msgContent || !msgContent.text || !msgContent.values) {
            throw new Error('Invalid message format: key or content is missing');
          }
          const result = await db.select([{ table: 'db_change_log' }], ['id', 'status'],
            {
              array: [
                ['id', msgKey],
                ['topic', message.topic],
                ['ingression_ts', ingressionTs]
              ], is_or: false
            },
            undefined, undefined, undefined, true
          );
          if (result && result.rows && result.rows.length > 0) {
            const recordStatus = result.rows[0]?.status || 'pending';
            if (recordStatus === 'success') {
              // console.log(`Message with key ${msgKey} already exists in db_change_log, skipping.`);
              return;
            }
          } else {
            // Will throw error if msgKey is already used
            await db.insert('db_change_log', {
              id: msgKey,
              topic: message.topic,
              ingression_ts: ingressionTs,
              headers: message.headers || {},
              message: msgContent || {},
              status: 'pending',
            });
          }
          // Do the SQL checking here to prevent invalid or unauthorized writes
          // For demo purpose, we just run them no matter what
          const transactionResult = await db.transaction([
            async (_previousResult, dbClient) => {
              const result = await dbClient.query(msgContent.text, msgContent.values);
              return { rows: result.rows, count: result.rowCount || 0, ttl: undefined }
            },
            async (_previousResult, dbClient) => {
              // Update the status to success
              const query = db.buildUpdateQuery('db_change_log', { status: 'success' }, {
                array: [
                  ['id', msgKey],
                ], is_or: false
              });
              const result = await dbClient.query(query.text, query.values);
              return { rows: result.rows, count: result.rowCount || 0, ttl: undefined }
            },
          ])
        } catch (error) {
          console.error('Error processing Kafka message, will send to dead letter queue:', error);
          msgQueue.send([
            {
              topic: `${kafkaConfig.dbtopic}-dlq`,
              message: JSON.stringify(message),
              key: crypto.randomUUID(),
            }
          ]).then((msgRes) => {
            console.info(`Sent problematic message to dead letter with result:${msgRes}`);
          }).catch(err => {
            console.error('Error sending problematic message to dead letter:', err);
          });
          errorCount += 1;
        }
      }
    }])
  } catch (e) {
    console.error('Error connecting to the Kafka message queue and doing subscription:', e);
  }

  const app = express();
  const port = process.env.SERVER_PORT || 4100;

  // Set up API endpoints
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', consumer: 'running' });
  });

  app.get('/metrics', (req, res) => {
    // You can implement metrics reporting here
    res.json({
      received_messages: msgQueue?.receiveCount() || -1,
      processed_messages: msgQueue?.receiveCount() || -1,
      errors: errorCount,
      topics: [kafkaConfig.dbtopic]
    });
  });

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

  // Handle graceful shutdown
  const shutdown = async () => {
    console.info('Shutting down consumer...');
    try {
      await msgQueue?.disconnect(false);
      await msgQueue?.disconnect(true);
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

};

// Start the server
startServer();