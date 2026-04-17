# Stage 1: Build dependencies
FROM python:3.12-slim AS builder
WORKDIR /app

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Production runner
FROM python:3.12-slim AS runner
WORKDIR /app

# Security: non-root user
RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup appuser

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application
COPY --chown=appuser:appgroup worker.py .

USER appuser

ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check: verify the worker process is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import os, redis, pymongo; redis.from_url(os.getenv('REDIS_URL','redis://redis:6379')).ping(); pymongo.MongoClient(os.getenv('MONGO_URI','mongodb://mongo:27017/ai-task-platform'), serverSelectionTimeoutMS=3000).admin.command('ping'); print('ok')" || exit 1

CMD ["python", "-u", "worker.py"]
