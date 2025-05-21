const express = require('express');
const openRouter = express.Router();
const secureRouter = express.Router();
const returnCode = require('../libs/returnCode');
const { hash, compare } = require('bcrypt');
const jwt = require('jsonwebtoken');
import { v4 as uuidv4 } from 'uuid'
// Make sure to set your own secret in .env file
const tokenSecret = process.env.TOKEN_SECRET || require('crypto').randomBytes(64).toString('hex')
const tokenExpiry = process.env.TOKEN_EXPIRY || '3600s'

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
  );
  if (!result || result.rows.length < 1) {
    res.status(returnCode.SUCCESS.code).json({ success: false, message: 'Invalid username or password' });
    return
  }
  const { id, salt, password: hashedPW } = result.rows[0];
  // console.log('hashedPW', hashedPW, password, salt, (await compare(`${salt}:${password}`, hashedPW)));
  if (await compare(`${salt}:${password}`, hashedPW)) {
    const sessionId = uuidv4();
    const jwtToken = jwt.sign({ id, username, sessionId }, tokenSecret, { expiresIn: tokenExpiry });
    const result2 = await db.insert('user_valid_sessions', { session_id: sessionId, user_id: id });
    res.status(returnCode.SUCCESS.code).json({
      success: true,
      accessToken: jwt.sign({ id, username }, tokenSecret, { expiresIn: tokenExpiry })
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
  const result = await db.select([{ table: 'users' }], ['id'],
    {
      array: [
        { field: 'username', comparator: '=', value: username },
      ], is_or: false
    },
  );
  if (result && result.rows.length > 0) {
    const error = returnCode.ALREADY_EXISTS;
    return res.status(error.code).json({ message: 'Username already exists' });
  }
  const salt = Math.random().toString(36).substring(2, 15);
  const hashedPW = await hash(`${salt}:${newPassword}`, 10);
  const sessionId = uuidv4();

  // create new user and create a new session token
  const result = await db.transation([
    (_previousResult, dbClient) => {
      const query = db.buildInsertQuery('users', { username, password: hashedPW, salt });
      const result = await dbClient.query(query.text, query.values);
      return { rows: result.rows, count: result.rowCount || 0, ttl: undefined }
    },
    (_previousResult, dbClient) => {
      const userId = _previousResult?.rows?.[0]?.id || null;
      const query = db.buildInsertQuery('user_valid_sessions', { session_id: sessionId, user_id: userId });
      const result = await dbClient.query(query.text, query.values);
      return { rows: [{ result.rows }], count: result.rowCount || 0, ttl: undefined }
    },
  ])

  const userId = result?.rows?.[0]?.user_id || null;
  const jwtToken = jwt.sign({ id, username, sessionId }, tokenSecret, { expiresIn: tokenExpiry });
  res.status(returnCode.SUCCESS.code).json({
    success: true,
    accessToken: jwt.sign({ id, username }, tokenSecret, { expiresIn: tokenExpiry })
  });
  return

  const result2 = await db.insert('users', { username, password: hashedPW, salt });
  return res.status(returnCode.SUCCESS.code).json({ success: true });
});

const extractJWT = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(returnCode.UNAUTHORIZED.code).json({ message: 'Unauthorized' });
  }
  jwt.verify(token.replace('Bearer ', ''), tokenSecret, (err, decoded) => {
    if (err) {
      return res.status(returnCode.UNAUTHORIZED.code).json({ message: 'Unauthorized' });
    }
    req.userId = decoded.id;
    req.sessionId = decoded.sessionId;
    const result = await db.select(
      [{
        table: 'user_valid_sessions'
      }], ['user_id'],
      { array: [['session_id', req.sessionId], ['active', true], ['created_at', '>', `NOW() - ${tokenExpiry}`]], is_or: false },
    )
    if (result && result.rows.length > 0 && result.rows[0].user_id === req.userId) {
      next();
    }
    return res.status(returnCode.UNAUTHORIZED.code).json({ message: 'Session token expired' });
  });
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
    const result = await db.update('users', { password: newHashedPW, salt: newSalt }, {
      array: [
        { field: 'id', comparator: '=', value: req.userId },
      ], is_or: false
    });
    res.status(returnCode.SUCCESS.code).json({ success: true });
    return
  }
  res.status(returnCode.SUCCESS.code).json({ success: false, message: 'Invalid user or password' });
})

module.exports = { openRouter, secureRouter, extractJWT };