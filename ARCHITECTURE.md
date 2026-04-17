# AI Task Processing Platform — Architecture Document

## 1. System Overview

The platform is a distributed, asynchronous text-processing system built on the MERN stack augmented with a Python worker service. Users submit text tasks (uppercase, lowercase, reverse, word count) via a React frontend. The backend API validates requests, persists them to MongoDB, and publishes job references to a Redis queue. One or more Python workers dequeue jobs, process them, and update MongoDB with results and logs. The frontend polls for status changes.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                    React (Vite) Frontend                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP/REST (JWT)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js + Express API                        │
│         Auth │ Task CRUD │ Stats │ Rate Limiting                │
└─────────┬─────────────────────────┬───────────────────────────-─┘
          │ mongoose                │ ioredis RPUSH
          ▼                        ▼
┌──────────────────┐    ┌──────────────────────────────────────┐
│    MongoDB 7.0   │    │           Redis 7.2 Queue            │
│  (ai-task-      │    │  List: "ai-tasks"  (BLPOP)           │
│   platform db)   │    └──────────────────┬───────────────────┘
└────────┬─────────┘                       │
         │ pymongo read/write              │ BLPOP (blocking dequeue)
         └─────────────────────────────────┘
                        │
          ┌─────────────▼──────────────────┐
          │     Python Worker (×N)         │
          │  uppercase/lowercase/reverse/  │
          │  word_count operations         │
          └────────────────────────────────┘
```

---

## 2. Worker Scaling Strategy

### Current Implementation
Workers are stateless consumers that block on `BLPOP` with a configurable timeout. Because Redis guarantees at-most-once delivery through `BLPOP`, multiple worker pods can safely run concurrently — Redis delivers each job to exactly one worker.

### Kubernetes HPA (Default)
The `worker-hpa` scales the worker Deployment between **2 and 10 replicas** based on CPU utilization (target: 60%). This works for moderate load but reacts to CPU pressure rather than queue depth.

```
Worker replicas = max(2, min(10, ceil(queue_depth / target_concurrency)))
```

### KEDA — Recommended for Production
For true queue-depth-driven autoscaling, deploy [KEDA](https://keda.sh):

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaler
  namespace: ai-platform
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 1
  maxReplicaCount: 50
  triggers:
    - type: redis
      metadata:
        address: redis-service:6379
        listName: ai-tasks
        listLength: "5"    # 1 replica per 5 queued jobs
```

This ensures:
- 0 workers at idle (scale-to-zero)
- Instant scale-up when the queue grows
- Scale-down after stabilization window (3 min)

### Preventing Duplicate Processing
Each worker sets task `status = 'running'` atomically before processing. If the pod crashes mid-job, the task stays in `running` state. A separate **recovery cron job** (recommended addition) periodically finds tasks stuck in `running` for >10 min and requeues them.

---

## 3. Handling 100,000 Tasks per Day

**≈ 1.16 tasks/second average**, with likely burst patterns (business hours).

### Capacity Analysis

| Component | Bottleneck | Mitigation |
|---|---|---|
| Redis queue | Memory per job ref (~200B) | Tiny — 100k jobs ≈ 20MB |
| MongoDB writes | ~3 writes/task (create, running, done) = 300k ops/day | Well within Atlas M10 capacity |
| Workers | 1 worker processes ~1 task/second (text ops are fast) | 2 workers = comfortable 2× headroom |
| Backend API | ~100k create + 100k poll requests | 2 replicas handle >10k req/min |

### Recommendations for Sustained 100k/day

1. **Worker concurrency**: Each pod runs one `BLPOP` at a time. Scale to 3–5 pods for burst absorption.
2. **MongoDB write concern**: Use `{ w: 1, j: false }` for task log appends (non-critical) to reduce latency.
3. **Redis persistence**: Enable AOF (`appendonly yes`) so queued jobs survive a Redis restart.
4. **CDN for frontend**: Static assets via Cloudflare/CDN reduce API load.
5. **Connection pooling**: Mongoose pool size 10 (default) is sufficient; increase to 20 if aggregate latency increases.

---

## 4. Database Indexing Strategy

### Users Collection
```javascript
{ email: 1 }       // unique — login lookups
{ username: 1 }    // unique — registration conflict checks
{ createdAt: -1 }  // admin analytics
```

### Tasks Collection
```javascript
{ userId: 1, createdAt: -1 }  // PRIMARY: user's task list, sorted by newest
{ userId: 1, status: 1 }      // filter by status per user (dashboard filters)
{ status: 1, createdAt: 1 }   // worker recovery scan (pending/stuck jobs)
{ createdAt: -1 }             // admin/ops queries
```

### Query Patterns Covered

| Query | Index Used |
|---|---|
| `GET /api/tasks?status=success` | `{ userId, status }` |
| `GET /api/tasks` (list, newest first) | `{ userId, createdAt }` |
| Worker recovery: find stuck `running` tasks | `{ status, createdAt }` |
| Admin: tasks by date range | `{ createdAt }` |

### Partial Index (Optimization)
For recovering stuck jobs, add a partial index:
```javascript
db.tasks.createIndex(
  { status: 1, startedAt: 1 },
  { partialFilterExpression: { status: { $in: ["pending", "running"] } } }
)
```
This index is tiny (only active tasks) and makes the recovery query near-instant.

---

## 5. Redis Failure Handling

### Failure Modes

| Scenario | Impact | Mitigation |
|---|---|---|
| Redis unavailable at task creation | Task saved as `pending` in MongoDB, not queued | Backend returns warning; frontend notifies user; user can click "Run" later |
| Redis crashes mid-queue | Jobs in-memory queue lost | Enable Redis AOF persistence; jobs in MongoDB remain `pending` |
| Worker loses Redis connection | Worker reconnects with exponential back-off (3s, 6s, 12s...) | `retryStrategy` in ioredis; Python `connect_redis()` retry loop |
| Redis full | New `RPUSH` fails | `maxmemory-policy allkeys-lru` evicts old data; alerts on memory usage |

### Recovery Mechanism
A lightweight **recovery script** (cron or Kubernetes CronJob) runs every 5 minutes:
```python
# Find pending tasks not in queue, re-push to Redis
pending = db.tasks.find({"status": "pending", "createdAt": {"$lt": 5_min_ago}})
for task in pending:
    redis.rpush("ai-tasks", json.dumps({"taskId": str(task["_id"]), "operation": task["operation"]}))
```

### Backend Graceful Degradation
```javascript
// pushToQueue() returns false if Redis is unavailable
const queued = await pushToQueue(QUEUE_NAME, { taskId, operation });
if (!queued) {
  // Task is saved as 'pending' — recovery cron will pick it up
  task.logs.push({ level: 'warn', message: 'Queue temporarily unavailable' });
}
```

---

## 6. Staging and Production Environments

### Strategy: Namespace-per-Environment
Use separate Kubernetes namespaces with environment-specific ConfigMaps and Secrets:

```
ai-platform-staging   ← staging namespace
ai-platform           ← production namespace
```

### Argo CD ApplicationSet
```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: ai-platform-environments
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: staging
            namespace: ai-platform-staging
            branch: develop
            replicas: "1"
          - env: production
            namespace: ai-platform
            branch: main
            replicas: "2"
  template:
    metadata:
      name: ai-platform-{{env}}
    spec:
      source:
        repoURL: https://github.com/YOUR_ORG/ai-task-platform-infra.git
        targetRevision: "{{branch}}"
        path: k8s
      destination:
        server: https://kubernetes.default.svc
        namespace: "{{namespace}}"
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

### Promotion Flow
```
Developer Push → PR → develop branch
                          ↓
                    CI Pipeline (lint + build)
                          ↓
               Argo CD auto-syncs → STAGING
                          ↓
              QA approval + tag release → main
                          ↓
               Argo CD auto-syncs → PRODUCTION
```

### Environment Differences

| Setting | Staging | Production |
|---|---|---|
| Worker replicas | 1 | 2–10 (HPA) |
| Backend replicas | 1 | 2 |
| MongoDB | Internal K8s | MongoDB Atlas M10+ |
| Rate limiting | 200 req/15min | 100 req/15min |
| Log level | debug | info |
| TLS | Self-signed | cert-manager + Let's Encrypt |

---

## 7. Security Architecture

- **Passwords**: bcrypt with 12 salt rounds — brute-force resistant
- **JWT**: HS256, 7-day expiry, stored in client localStorage
- **Helmet**: Sets 11 security HTTP headers (CSP, HSTS, etc.)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Non-root containers**: All Docker images run as UID 1001
- **K8s Secrets**: Base64-encoded; upgrade to Sealed Secrets or Vault for production
- **Network Policy**: Pods communicate only within `ai-task-net`; external access only via Ingress
- **Input Validation**: `express-validator` on all API inputs; max text size 10,000 chars

---

## 8. Technology Choices Rationale

| Technology | Reason |
|---|---|
| **Redis LIST + BLPOP** | Simple, atomic, no message loss on single dequeue; no broker overhead |
| **MongoDB** | Flexible schema (task logs array); horizontal scalability; strong ecosystem |
| **Python worker** | Excellent for text processing; easy to add ML/NLP operations later |
| **Vite + React** | Fast HMR, small bundle, ideal for dashboard SPA |
| **k3s** | Lightweight K8s for on-prem/edge; full K8s API compatibility |
| **Argo CD** | GitOps ensures cluster state = Git state; audit trail via git history |
