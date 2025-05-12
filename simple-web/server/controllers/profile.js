const express = require('express');
const router = express.Router();
const returnCode = require('../libs/returnCode');

// TODO: try catch, and also make things more modular
router.get('/', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  if (!req.userId) {
    const error = returnCode.UNAUTHORIZED;
    return res.status(error.code).json({ error: 'User not logged in' });
  }
  const db = req.app.db;
  const result = await db.select(
    [{
      table: 'user_extra_info'
    }],
    ['self_remark'],
    {
      array: [
        { field: 'user_id', comparator: '=', value: req.userId },
      ], is_or: false
    }
  )

  res.json({ content: result?.rows?.[0]?.self_remark || '' });
});

router.post('/', async (req, res) => {
  if (!req.app.db) {
    const error = returnCode.DATABASE_CONNECTION_ERROR;
    return res.status(error.code).json({ error: error.message });
  }
  if (!req.userId) {
    const error = returnCode.UNAUTHORIZED;
    return res.status(error.code).json({ error: 'User not logged in' });
  }

  const db = req.app.db;
  const { content } = req.body;
  const result = await db.upsert(
    'user_extra_info',
    ['user_id'],
    { user_id: req.userId, self_remark: content }
  );
  res.json({ success: true, data: result });
});

module.exports = router;