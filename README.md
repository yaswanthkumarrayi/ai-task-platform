# AI Task Processing Platform

A production-ready MERN + Python worker platform for asynchronous text processing tasks, deployed on Kubernetes with Argo CD GitOps and full CI/CD.

## 🏗️ Architecture

```
Frontend (React) → Backend API (Express) → Redis Queue → Python Worker → MongoDB
```

| Service | Technology | Port |
|---|---|---|
| Frontend | React + Vite + Nginx | 3000 |
| Backend API | Node.js + Express | 5000 |
| Worker | Python 3.12 | — |
| Database | MongoDB 7.0 | 27017 |
| Queue | Redis 7.2 | 6379 |

## ✨ Features

- **User Auth**: JWT-based register/login with bcrypt password hashing
- **Task Operations**: uppercase, lowercase, reverse string, word count
- **Async Processing**: Redis queue → Python worker → MongoDB status updates
- **Real-time Status**: Dashboard polls every 4s for running task updates
- **Task Logs**: Detailed per-task processing logs with timestamps
- **Security**: Helmet, rate limiting, input validation, non-root containers

## 📁 Repository Structure

```
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── index.js
│   │   ├── models/        # Mongoose schemas (User, Task)
│   │   ├── routes/        # auth.js, tasks.js
│   │   ├── middleware/    # JWT auth
│   │   └── config/        # Redis client
│   └── Dockerfile
├── worker/                # Python job processor
│   ├── worker.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── pages/         # Login, Register, Dashboard, TaskDetail
│   │   ├── api/           # Axios client
│   │   └── context/       # Auth context
│   └── Dockerfile
├── infra/                 # Infrastructure (push as separate repo)
│   ├── k8s/               # Kubernetes manifests
│   └── argocd/            # Argo CD Application
├── .github/workflows/     # CI/CD pipeline
├── docker-compose.yml
└── ARCHITECTURE.md
```

## 🚀 Quick Start — Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local dev without Docker)

### With Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ai-task-platform.git
cd ai-task-platform

# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and set JWT_SECRET to a strong random string

# Start all services
docker-compose up --build

# Access the app
open http://localhost:3000
```

**Services available:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/health

### Scale Workers Locally

```bash
# Run 3 worker instances for higher throughput
docker-compose up --scale worker=3
```

### Local Dev Without Docker

```bash
# Terminal 1: Start MongoDB & Redis
docker-compose up mongo redis

# Terminal 2: Backend
cd backend
npm install
cp .env.example .env   # edit JWT_SECRET
npm run dev

# Terminal 3: Worker
cd worker
pip install -r requirements.txt
cp .env.example .env
python worker.py

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/ai-task-platform` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `FRONTEND_URLS` | Comma-separated CORS allowlist | `http://localhost:3000` |
| `TRUST_PROXY` | Trust reverse proxy headers | `false` |
| `JWT_SECRET` | **Required** — JWT signing secret (min 32 chars) | — |
| `JWT_EXPIRES_IN` | JWT token lifetime | `7d` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

### Worker (`worker/.env`)

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/ai-task-platform` |
| `REDIS_QUEUE_NAME` | Queue name to consume | `ai-tasks` |
| `MAX_RETRIES` | Job retry attempts | `3` |

## 🐳 Docker Images

Build individually:

```bash
docker build -t ai-task-backend ./backend
docker build -t ai-task-worker ./worker
docker build -t ai-task-frontend ./frontend
```

All images use **multi-stage builds** and run as **non-root users**.

## ☸️ Kubernetes Deployment

### Prerequisites
- k3s or any Kubernetes cluster
- kubectl configured
- Nginx Ingress Controller installed

### Install Nginx Ingress (k3s)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yml
```

### Deploy the Platform

```bash
# 1. Edit secrets in infra/k8s/secrets.yaml
# Required keys:
#   JWT_SECRET
#   MONGO_ROOT_USERNAME
#   MONGO_ROOT_PASSWORD
#   REDIS_PASSWORD
#   MONGO_URI (must match mongo credentials)
#   REDIS_URL (must include redis password)

# 2. Replace DOCKER_USERNAME in backend.yaml, worker.yaml, frontend.yaml
sed -i 's/DOCKER_USERNAME/yourdockerhubuser/g' infra/k8s/*.yaml

# 3. Apply manifests
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/

# 4. Verify pods
kubectl get pods -n ai-platform

# 5. Add host entry (for local testing)
echo "$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.spec.clusterIP}') ai-platform.local" | sudo tee -a /etc/hosts
```

### Check Deployment Status

```bash
kubectl get all -n ai-platform
kubectl logs -n ai-platform deployment/worker -f
kubectl logs -n ai-platform deployment/backend -f
```

## 🔄 Argo CD Setup

```bash
# 1. Install Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. Wait for it to be ready
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=120s

# 3. Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 4. Port-forward Argo CD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 5. Push infra/ directory to a separate GitHub repo
# Update repoURL in infra/argocd/app.yaml

# 6. Apply Argo CD Application
kubectl apply -f infra/argocd/app.yaml
```

Argo CD will auto-sync every time changes are pushed to the infra repository.

## 🔁 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`:

1. **Lint** — ESLint (backend + frontend), flake8 (worker)
2. **Build & Push** — Docker images tagged with git SHA pushed to Docker Hub
3. **Update Infra** — Automatically updates image tags in infra repo → triggers Argo CD sync

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |
| `INFRA_REPOSITORY` | Infra repo in format `owner/repo` |
| `GH_PAT` | GitHub Personal Access Token (repo scope) for pushing to infra repo |

## 📊 Task Operations

| Operation | Input | Output |
|---|---|---|
| `uppercase` | Any text | TEXT IN UPPERCASE |
| `lowercase` | Any text | text in lowercase |
| `reverse` | Any text | txet desreveR |
| `word_count` | Any text | JSON: word count, char count, sentence count, unique words |

## 🏥 Health Checks

| Endpoint | Service |
|---|---|
| `GET /health` | Backend — returns DB connection status |
| Redis `PING` | Worker liveness probe |
| `GET /` | Frontend nginx |

## 🧪 API Reference

### Auth

```
POST /api/auth/register   { username, email, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me         (requires Bearer token)
```

### Tasks

```
POST   /api/tasks              Create task
GET    /api/tasks              List tasks (paginated, ?status=pending)
GET    /api/tasks/:id          Get task with logs
POST   /api/tasks/:id/run      Queue task for processing
DELETE /api/tasks/:id          Delete task
GET    /api/tasks/stats/summary  Dashboard stats
```

## 🔒 Security

- Passwords hashed with **bcrypt** (12 salt rounds)
- **JWT** authentication (7-day tokens)
- **Helmet** middleware (11 security headers)
- **Rate limiting**: 100 requests per 15 minutes per IP
- **Input validation**: All inputs validated with express-validator
- **Non-root containers**: All services run as UID 1001
- No secrets hardcoded — all via environment variables / K8s Secrets

## 📄 Additional Documentation

- [Architecture Document](./ARCHITECTURE.md) — scaling strategy, indexing, Redis failure handling
- [Infra Repository](https://github.com/YOUR_USERNAME/ai-task-platform-infra) — Kubernetes manifests

## 📝 License

MIT
