// MongoDB initialization script
// Creates indexes for optimal query performance

db = db.getSiblingDB('ai-task-platform');

// Users collection indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

// Tasks collection indexes
db.tasks.createIndex({ userId: 1, createdAt: -1 });
db.tasks.createIndex({ userId: 1, status: 1 });
db.tasks.createIndex({ status: 1, createdAt: 1 });

print('MongoDB initialization complete: indexes created.');
