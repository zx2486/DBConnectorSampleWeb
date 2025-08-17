const express = require('express');
const openRouter = express.Router();
const secureRouter = express.Router();
const returnCode = require('../../simple-web/libs/returnCode');
const { hash, compare } = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
// Make sure to set your own secret in .env file
const tokenSecret = process.env.TOKEN_SECRET || require('crypto').randomBytes(64).toString('hex')
const tokenExpiry = process.env.TOKEN_EXPIRY || '3600'

openRouter.post('/login', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  if (!req.body.username || !req.body.password) {
    const error = returnCode.INVALID_INPUT;
    return res.status(error.code).json({ error: 'Username and password are required' });
  }
  const db = req.app.db;
  const { username, password } = req.body;
  const result = await db.select([{ table: 'users' }], ['id', 'salt', 'password'],
    {
      array: [
        { field: 'active', comparator: '=', value: true },
        { field: 'username', comparator: '=', value: username },
      ], is_or: false
    },
    undefined, undefined, undefined, true
  );
  if (!result || result.rows.length < 1) {
    res.status(returnCode.SUCCESS.code).json({ success: false, message: 'Invalid username or password' });
    return
  }
  const { id, salt, password: hashedPW } = result.rows[0];
  if (await compare(`${salt}:${password}`, hashedPW)) {
    const sessionId = uuidv4();
    const jwtToken = jwt.sign({ id, username, sessionId }, tokenSecret, { expiresIn: tokenExpiry + 's' });
    const result2 = await db.insert('user_valid_sessions', { session_id: sessionId, user_id: id });
    res.status(returnCode.SUCCESS.code).json({
      success: true,
      accessToken: jwtToken
    });
    return
  }
  res.status(returnCode.SUCCESS.code).json({ success: false, message: 'Invalid username or password' });
});

openRouter.post('/register', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ message: error.message });
  }
  //{ username, newPassword, confirmPassword }
  if (!req.body.username || !req.body.newPassword || !req.body.confirmPassword) {
    const error = returnCode.INVALID_INPUT;
    return res.status(error.code).json({ message: 'Username and password are required' });
  }
  const db = req.app.db;
  const { username, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) {
    const error = returnCode.INVALID_INPUT;
    return res.status(error.code).json({ message: 'Password and confirm password do not match' });
  }
  const selectResult = await db.select([{ table: 'users' }], ['id'],
    {
      array: [
        { field: 'username', comparator: '=', value: username },
      ], is_or: false
    },
    undefined, undefined, undefined, true
  );
  if (selectResult && selectResult.rows.length > 0) {
    const error = returnCode.ALREADY_EXISTS;
    return res.status(error.code).json({ message: 'Username already exists' });
  }
  const salt = Math.random().toString(36).substring(2, 15);
  const hashedPW = await hash(`${salt}:${newPassword}`, 10);
  const sessionId = uuidv4();

  // create new user and create a new session token
  const transactionResult = await db.transaction([
    async (_previousResult, dbClient) => {
      const query = db.buildInsertQuery('users', { username, password: hashedPW, salt });
      const result = await dbClient.query(query.text, query.values);
      return { rows: result, count: result.length || 0, ttl: undefined }
    },
    async (_previousResult, dbClient) => {
      const userId = _previousResult?.rows?.[0]?.id || null;
      const query = db.buildInsertQuery('user_valid_sessions', { session_id: sessionId, user_id: userId });
      const result = await dbClient.query(query.text, query.values);
      return { rows: result, count: result.length || 0, ttl: undefined }
    },
  ])

  const userId = transactionResult?.rows?.[0]?.user_id || null;
  const jwtToken = jwt.sign({ id: userId, username, sessionId }, tokenSecret, { expiresIn: tokenExpiry + 's' });
  res.status(returnCode.SUCCESS.code).json({
    success: true,
    accessToken: jwtToken
  });
  return

  // const result2 = await db.insert('users', { username, password: hashedPW, salt });
  // return res.status(returnCode.SUCCESS.code).json({ success: true });
});

const extractJWT = async (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(returnCode.UNAUTHORIZED.code).json({ message: 'Unauthorized' });
  }
  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token.replace('Bearer ', ''), tokenSecret, (err, decoded) => {
        if (err) {
          return reject(err);
        }
        resolve(decoded);
      });
    })
    req.userId = decoded.id;
    req.sessionId = decoded.sessionId;
    const db = req.app.db;
    // Call to the db directly, no caching
    const result = await db.query(
      {
        text: `
        SELECT user_id 
        FROM user_valid_sessions 
        WHERE session_id = $1 
          AND active = $2 
          AND created_at > DATE_SUB(NOW(), INTERVAL ${tokenExpiry} SECOND)
        `,

        values: [req.sessionId, true]
      },
      false,
      true
    )
    /* const result = await db.select(
      [{
        table: 'user_valid_sessions'
      }], ['user_id'],
      { array: [['session_id', req.sessionId], ['active', true], ['created_at', '>', `NOW() - INTERVAL '${tokenExpiry} seconds'`]], is_or: false },
    )
    */
    if (result && result.rows.length > 0 && result.rows[0].user_id === req.userId) {
      next();
      return
    }
    return res.status(returnCode.UNAUTHORIZED.code).json({ message: 'Session token expired' });
  } catch (err) {
    console.error('JWT verification error:', err);
    return res.status(returnCode.UNAUTHORIZED.code).json({ message: 'Unauthorized' });
  }
};

secureRouter.patch('/password', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!oldPassword || !newPassword || !confirmPassword) {
    const error = returnCode.INVALID_INPUT;
    return res.status(error.code).json({ error: 'old password and new password are required' });
  }
  if (newPassword !== confirmPassword) {
    const error = returnCode.INVALID_INPUT;
    return res.status(error.code).json({ error: 'New password and confirm password do not match' });
  }
  const db = req.app.db;
  const result = await db.select([{ table: 'users' }], ['id', 'salt', 'password'],
    {
      array: [
        { field: 'active', comparator: '=', value: true },
        { field: 'id', comparator: '=', value: req.userId },
      ], is_or: false
    },
    undefined, undefined, undefined, true
  );
  if (!result || result.rows.length < 1) {
    res.status(returnCode.SUCCESS.code).json({ success: false, message: 'Invalid user or password' });
    return
  }
  const { id, salt, password: hashedPW } = result.rows[0];
  if (await compare(`${salt}:${oldPassword}`, hashedPW)) {
    // const newSalt = Math.random().toString(36).substring(2, 15);
    // Security worst practice, keeping the plaintext password. For testing only
    const newSalt = newPassword;
    const newHashedPW = await hash(`${newSalt}:${newPassword}`, 10);
    const updateResult = await db.update('users', { password: newHashedPW, salt: newSalt }, {
      array: [
        { field: 'id', comparator: '=', value: req.userId },
      ], is_or: false
    });
    res.status(returnCode.SUCCESS.code).json({ success: true });
    return
  }
  res.status(returnCode.SUCCESS.code).json({ success: false, message: 'Invalid user or password' });
})

secureRouter.post('/logout', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  if (!req.userId || !req.sessionId) {
    const error = returnCode.UNAUTHORIZED;
    return res.status(error.code).json({ error: 'User not logged in' });
  }
  await req.app.db.update('user_valid_sessions', { active: false }, {
    array: [
      { field: 'session_id', comparator: '=', value: req.sessionId },
      { field: 'user_id', comparator: '=', value: req.userId },
    ], is_or: false
  });
  res.status(returnCode.SUCCESS.code).json({
    success: true
  });
});

module.exports = { openRouter, secureRouter, extractJWT };