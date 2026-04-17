const Redis = require('ioredis');

let client = null;
let isConnected = false;

const getRedisClient = () => {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 5000);
      console.log(`[Redis] Retry attempt ${times}, next in ${delay}ms`);
      return delay;
    },
    lazyConnect: false,
    enableReadyCheck: true,
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true;
      }
      return false;
    },
  });

  client.on('connect', () => {
    console.log('[Redis] Connecting...');
  });

  client.on('ready', () => {
    isConnected = true;
    console.log('[Redis] Ready');
  });

  client.on('error', (err) => {
    isConnected = false;
    console.error('[Redis] Error:', err.message);
  });

  client.on('close', () => {
    isConnected = false;
    console.warn('[Redis] Connection closed');
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return client;
};

const isRedisConnected = () => isConnected;

/**
 * Gracefully close Redis connection on app shutdown.
 */
const closeRedisClient = async () => {
  if (!client) return;

  try {
    await client.quit();
  } catch (err) {
    console.warn('[Redis] Graceful quit failed, disconnecting forcefully:', err.message);
    client.disconnect();
  } finally {
    client = null;
    isConnected = false;
  }
};

/**
 * Push a job to the Redis queue.
 * Falls back gracefully if Redis is unavailable.
 */
const pushToQueue = async (queueName, payload) => {
  const redis = getRedisClient();
  try {
    const serialized = JSON.stringify(payload);
    await redis.rpush(queueName, serialized);
    console.log(`[Redis] Job pushed to queue "${queueName}": taskId=${payload.taskId}`);
    return true;
  } catch (err) {
    console.error(`[Redis] Failed to push to queue "${queueName}":`, err.message);
    return false;
  }
};

module.exports = { getRedisClient, isRedisConnected, pushToQueue, closeRedisClient };
