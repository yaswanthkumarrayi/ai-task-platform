"""
AI Task Processing Worker
Consumes jobs from Redis queue and processes them against MongoDB.

Operations supported:
  - uppercase     : Convert input text to UPPERCASE
  - lowercase     : Convert input text to lowercase
  - reverse       : Reverse the input string
  - word_count    : Count words, characters, sentences
"""

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone

import redis
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# ─── Load Environment ──────────────────────────────────────────────────────────
load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai-task-platform")
QUEUE_NAME = os.getenv("REDIS_QUEUE_NAME", "ai-tasks")
WORKER_ID = os.getenv("HOSTNAME", "worker-local")
BLOCK_TIMEOUT = int(os.getenv("REDIS_BLOCK_TIMEOUT", "5"))   # seconds BLPOP blocks
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(f"worker.{WORKER_ID}")

# ─── Graceful Shutdown ─────────────────────────────────────────────────────────
shutdown_requested = False

def handle_signal(signum, _frame):
    global shutdown_requested
    logger.info(f"Signal {signum} received. Finishing current job then shutting down...")
    shutdown_requested = True

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

# ─── Operations ───────────────────────────────────────────────────────────────
def process_operation(operation: str, input_text: str) -> dict:
    """
    Execute the requested operation on the input text.
    Returns a dict with 'result' and 'logs' keys.
    """
    logs = []

    def log(level: str, msg: str):
        logs.append({"level": level, "message": msg, "timestamp": datetime.now(timezone.utc).isoformat()})
        logger.info(f"[{level.upper()}] {msg}")

    log("info", f"Starting operation: {operation}")
    start = time.monotonic()

    try:
        if operation == "uppercase":
            result = input_text.upper()
            log("info", f"Converted {len(input_text)} characters to uppercase.")

        elif operation == "lowercase":
            result = input_text.lower()
            log("info", f"Converted {len(input_text)} characters to lowercase.")

        elif operation == "reverse":
            result = input_text[::-1]
            log("info", f"Reversed string of {len(input_text)} characters.")

        elif operation == "word_count":
            words = input_text.split()
            word_count = len(words)
            char_count = len(input_text)
            char_no_spaces = len(input_text.replace(" ", ""))
            # Simple sentence detection
            sentence_count = max(1, input_text.count('.') + input_text.count('!') + input_text.count('?'))
            unique_words = len(set(w.lower().strip('.,!?;:') for w in words))
            avg_word_length = round(char_no_spaces / word_count, 2) if word_count > 0 else 0

            result = json.dumps({
                "word_count": word_count,
                "character_count": char_count,
                "character_count_no_spaces": char_no_spaces,
                "sentence_count": sentence_count,
                "unique_words": unique_words,
                "average_word_length": avg_word_length,
            }, indent=2)
            log("info", f"Word count analysis: {word_count} words, {char_count} chars.")

        else:
            raise ValueError(f"Unknown operation: {operation}")

    except ValueError as e:
        log("error", str(e))
        raise

    elapsed = round((time.monotonic() - start) * 1000, 2)
    log("info", f"Operation completed in {elapsed}ms.")

    return {"result": result, "logs": logs}


# ─── MongoDB helpers ──────────────────────────────────────────────────────────
def update_task(db, task_id: str, update: dict):
    try:
        db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": update},
        )
    except PyMongoError as e:
        logger.error(f"[MongoDB] Failed to update task {task_id}: {e}")
        raise


def append_logs(db, task_id: str, new_logs: list):
    try:
        db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$push": {"logs": {"$each": new_logs}}},
        )
    except PyMongoError as e:
        logger.error(f"[MongoDB] Failed to append logs for task {task_id}: {e}")


# ─── Job Processor ────────────────────────────────────────────────────────────
def process_job(db, job: dict):
    task_id = job.get("taskId")
    operation = job.get("operation")

    if not task_id or not operation:
        logger.error(f"[Worker] Invalid job payload: {job}")
        return

    logger.info(f"[Worker] Processing task {task_id} | operation={operation}")

    # Fetch task from MongoDB
    try:
        task = db.tasks.find_one({"_id": ObjectId(task_id)})
    except Exception as e:
        logger.error(f"[Worker] Could not fetch task {task_id}: {e}")
        return

    if not task:
        logger.warning(f"[Worker] Task {task_id} not found in DB. Skipping.")
        return

    if task.get("status") not in ("pending",):
        logger.warning(f"[Worker] Task {task_id} has status '{task.get('status')}'. Skipping.")
        return

    # Mark as running
    now = datetime.now(timezone.utc)
    update_task(db, task_id, {
        "status": "running",
        "startedAt": now,
    })
    append_logs(db, task_id, [{
        "level": "info",
        "message": f"Worker {WORKER_ID} picked up the task.",
        "timestamp": now,
    }])

    # Execute
    try:
        outcome = process_operation(operation, task["inputText"])

        completed_at = datetime.now(timezone.utc)
        update_task(db, task_id, {
            "status": "success",
            "result": outcome["result"],
            "completedAt": completed_at,
            "errorMessage": None,
        })
        append_logs(db, task_id, outcome["logs"] + [{
            "level": "info",
            "message": "Task completed successfully.",
            "timestamp": completed_at,
        }])
        logger.info(f"[Worker] Task {task_id} completed successfully.")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Worker] Task {task_id} failed: {error_msg}")
        failed_at = datetime.now(timezone.utc)
        update_task(db, task_id, {
            "status": "failed",
            "errorMessage": error_msg,
            "completedAt": failed_at,
        })
        append_logs(db, task_id, [{
            "level": "error",
            "message": f"Task failed: {error_msg}",
            "timestamp": failed_at,
        }])


# ─── Connection Factory ────────────────────────────────────────────────────────
def connect_redis(retry_interval: float = 3.0) -> redis.Redis:
    while not shutdown_requested:
        try:
            r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=5)
            r.ping()
            logger.info(f"[Redis] Connected to {REDIS_URL}")
            return r
        except Exception as e:
            logger.warning(f"[Redis] Connection failed: {e}. Retrying in {retry_interval}s...")
            time.sleep(retry_interval)
    sys.exit(0)


def connect_mongo(retry_interval: float = 3.0) -> MongoClient:
    db_name = MONGO_URI.split("/")[-1].split("?")[0] or "ai-task-platform"
    while not shutdown_requested:
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            logger.info(f"[MongoDB] Connected — db: {db_name}")
            return client[db_name]
        except Exception as e:
            logger.warning(f"[MongoDB] Connection failed: {e}. Retrying in {retry_interval}s...")
            time.sleep(retry_interval)
    sys.exit(0)


# ─── Main Loop ────────────────────────────────────────────────────────────────
def main():
    logger.info(f"[Worker] Starting AI Task Worker | id={WORKER_ID} | queue={QUEUE_NAME}")

    r = connect_redis()
    db = connect_mongo()

    logger.info("[Worker] Ready. Waiting for jobs...")

    while not shutdown_requested:
        try:
            # Blocking pop — waits BLOCK_TIMEOUT seconds for a job
            item = r.blpop(QUEUE_NAME, timeout=BLOCK_TIMEOUT)

            if item is None:
                # Timeout expired, loop again (allows checking shutdown_requested)
                continue

            _, raw = item
            try:
                job = json.loads(raw)
            except json.JSONDecodeError:
                logger.error(f"[Worker] Malformed job payload: {raw}")
                continue

            # Retry logic for transient errors
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    process_job(db, job)
                    break
                except Exception as e:
                    if attempt == MAX_RETRIES:
                        logger.error(f"[Worker] Job failed after {MAX_RETRIES} attempts: {e}")
                    else:
                        wait = 2 ** attempt
                        logger.warning(f"[Worker] Attempt {attempt} failed, retrying in {wait}s: {e}")
                        time.sleep(wait)

        except redis.exceptions.ConnectionError as e:
            logger.error(f"[Redis] Lost connection: {e}. Reconnecting...")
            time.sleep(3)
            try:
                r = connect_redis()
            except SystemExit:
                break

        except Exception as e:
            logger.error(f"[Worker] Unexpected error in main loop: {e}", exc_info=True)
            time.sleep(1)

    logger.info("[Worker] Shutdown complete.")


if __name__ == "__main__":
    main()
