const express = require('express');
const router = express.Router();
const returnCode = require('../libs/returnCode');
const { extractJWT } = require('./login');

router.get('/', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  const db = req.app.db;
  // Get the records which maybe cached
  const result = await db.select(
    [{
      table: 'posts'
    }, {
      table: 'users', join_type: 'INNER',
      on: [{ left: 'posts.author_id', right: 'users.id' }]
    }],
    ['posts.id', 'posts.title', 'posts.content', 'users.username as author_name'],
    { array: [['posts.active', true], ['users.active', true]], is_or: false },
  )
  res.json(result);
});

const checkLoginAndDB = (req, res, next) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  if (!req.userId) {
    const error = returnCode.INVALID_REQUEST;
    return res.status(error.code).json({ error: 'User not logged in' });
  }
  next();
}

router.get('/me', extractJWT, checkLoginAndDB, async (req, res) => {
  const db = req.app.db;
  // Get the latest records
  const result = await db.select(
    [{
      table: 'posts'
    }],
    ['id', 'title', 'content', 'active'],
    { array: [['author_id', req.userId]], is_or: false },
    undefined, undefined, undefined, true
  )
  res.json(result);
});

router.post('/', extractJWT, checkLoginAndDB, async (req, res) => {
  if (!req.body.title || !req.body.content) {
    const error = returnCode.INVALID_INPUT;
    return res.status(error.code).json({ error: 'Title and content are required' });
  }
  const db = req.app.db;
  const { title, content } = req.body;
  const result = await db.insert('posts', { title, content, author_id: req.userId });
  res.json(result);
});

router.put('/:post_id', extractJWT, checkLoginAndDB, async (req, res) => {
  if (!req.params.post_id) {
    const error = returnCode.INVALID_REQUEST;
    return res.status(error.code).json({ error: 'Post ID is required' });
  }
  if (req.body.active === undefined) {
    const error = returnCode.INVALID_REQUEST;
    return res.status(error.code).json({ error: 'Active status is required' });
  }
  const db = req.app.db;
  const postId = req.params.post_id;
  const condition = { array: [['author_id', req.userId], ['id', postId]], is_or: false };
  const selectResult = await db.select(
    [{
      table: 'posts'
    }],
    ['id'],
    condition,
    undefined, undefined, undefined, true
  )
  if (!selectResult.rows || selectResult.count < 1) {
    const error = returnCode.NOT_FOUND;
    return res.status(error.code).json({ error: 'Post not found or not authorized to delete' });
  }
  const result = await db.update('posts', { active: req.body.active }, condition);
  res.json(result);
});

router.delete('/:post_id', extractJWT, checkLoginAndDB, async (req, res) => {
  if (!req.params.post_id) {
    const error = returnCode.INVALID_REQUEST;
    return res.status(error.code).json({ error: 'Post ID is required' });
  }
  const db = req.app.db;
  const postId = req.params.post_id;
  const condition = { array: [['author_id', req.userId], ['id', postId]], is_or: false };
  const selectResult = await db.select(
    [{
      table: 'posts'
    }],
    ['id'],
    condition,
    undefined, undefined, undefined, true
  )
  if (!selectResult.rows || selectResult.count < 1) {
    const error = returnCode.NOT_FOUND;
    return res.status(error.code).json({ error: 'Post not found or not authorized to delete' });
  }
  const result = await db.delete('posts', condition);
  res.json(result);
});

module.exports = router;