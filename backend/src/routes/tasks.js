const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Task = require('../models/Task');
const { VALID_OPERATIONS } = require('../models/Task');
const authMiddleware = require('../middleware/auth');
const { pushToQueue } = require('../config/redis');

const router = express.Router();

// All task routes require authentication
router.use(authMiddleware);

const QUEUE_NAME = process.env.REDIS_QUEUE_NAME || 'ai-tasks';

// ─── Validation ───────────────────────────────────────────────────────────────
const createTaskValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('inputText').trim().notEmpty().withMessage('Input text is required').isLength({ max: 10000 }),
  body('operation')
    .isIn(VALID_OPERATIONS)
    .withMessage(`Operation must be one of: ${VALID_OPERATIONS.join(', ')}`),
];

// ─── POST /api/tasks — Create task ───────────────────────────────────────────
router.post('/', createTaskValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { title, inputText, operation } = req.body;

    const task = new Task({
      title,
      inputText,
      operation,
      status: 'pending',
      userId: req.user._id,
      logs: [{ level: 'info', message: 'Task created and queued for processing.' }],
    });

    await task.save();

    // Push to Redis queue
    const queued = await pushToQueue(QUEUE_NAME, {
      taskId: task._id.toString(),
      operation: task.operation,
    });

    if (!queued) {
      task.logs.push({
        level: 'warn',
        message: 'Warning: Could not push to Redis queue. Task may be delayed.',
      });
      await task.save();
    }

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (err) {
    console.error('[Tasks] Create error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// ─── GET /api/tasks — List user's tasks ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (req.query.status && ['pending', 'running', 'success', 'failed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .select('-logs') // exclude logs for list view (performance)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Task.countDocuments(filter),
    ]);

    res.json({
      tasks,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Tasks] List error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// ─── GET /api/tasks/:id — Single task with logs ───────────────────────────────
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid task ID' });

      const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
      if (!task) return res.status(404).json({ error: 'Task not found.' });

      res.json({ task });
    } catch (err) {
      console.error('[Tasks] Get error:', err);
      res.status(500).json({ error: 'Failed to fetch task.' });
    }
  }
);

// ─── POST /api/tasks/:id/run — Re-queue a pending task ───────────────────────
router.post(
  '/:id/run',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid task ID' });

      const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
      if (!task) return res.status(404).json({ error: 'Task not found.' });

      if (!['pending', 'failed'].includes(task.status)) {
        return res.status(400).json({
          error: `Cannot run a task with status "${task.status}". Only pending or failed tasks can be re-run.`,
        });
      }

      // Reset task for re-processing
      task.status = 'pending';
      task.result = null;
      task.errorMessage = null;
      task.startedAt = null;
      task.completedAt = null;
      task.logs.push({ level: 'info', message: 'Task re-queued by user.' });
      await task.save();

      const queued = await pushToQueue(QUEUE_NAME, {
        taskId: task._id.toString(),
        operation: task.operation,
      });

      if (!queued) {
        return res.status(503).json({
          error: 'Queue unavailable. Task saved as pending — will be retried when queue recovers.',
          task,
        });
      }

      res.json({ message: 'Task queued for processing', task });
    } catch (err) {
      console.error('[Tasks] Run error:', err);
      res.status(500).json({ error: 'Failed to queue task.' });
    }
  }
);

// ─── DELETE /api/tasks/:id — Delete a task ───────────────────────────────────
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid task ID' });

      const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
      if (!task) return res.status(404).json({ error: 'Task not found.' });

      res.json({ message: 'Task deleted successfully' });
    } catch (err) {
      console.error('[Tasks] Delete error:', err);
      res.status(500).json({ error: 'Failed to delete task.' });
    }
  }
);

// ─── GET /api/tasks/stats/summary — Task stats for dashboard ─────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Task.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = { pending: 0, running: 0, success: 0, failed: 0, total: 0 };
    stats.forEach(({ _id, count }) => {
      summary[_id] = count;
      summary.total += count;
    });

    res.json({ stats: summary });
  } catch (err) {
    console.error('[Tasks] Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

module.exports = router;
