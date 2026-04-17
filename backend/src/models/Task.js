const mongoose = require('mongoose');

const VALID_OPERATIONS = ['uppercase', 'lowercase', 'reverse', 'word_count'];
const VALID_STATUSES = ['pending', 'running', 'success', 'failed'];

const logEntrySchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    inputText: {
      type: String,
      required: [true, 'Input text is required'],
      maxlength: [10000, 'Input text cannot exceed 10,000 characters'],
    },
    operation: {
      type: String,
      required: [true, 'Operation is required'],
      enum: {
        values: VALID_OPERATIONS,
        message: 'Operation must be one of: ' + VALID_OPERATIONS.join(', '),
      },
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'pending',
    },
    result: {
      type: String,
      default: null,
    },
    logs: {
      type: [logEntrySchema],
      default: [],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
taskSchema.index({ userId: 1, createdAt: -1 });   // user's task list (most common query)
taskSchema.index({ userId: 1, status: 1 });         // filter by status
taskSchema.index({ status: 1, createdAt: 1 });      // worker picks pending jobs
taskSchema.index({ createdAt: -1 });                // admin/analytics queries

module.exports = mongoose.model('Task', taskSchema);
module.exports.VALID_OPERATIONS = VALID_OPERATIONS;
