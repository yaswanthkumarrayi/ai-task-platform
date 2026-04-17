# 🚀 Complete Deployment Guide

## ✅ Current Status

- ✓ Local Docker Compose: **ALL 5 SERVICES RUNNING HEALTHY**
- ✓ Infra repo pushed to GitHub: `yaswanthkumarrayi/ai-task-platform-infra`
- ✓ Main repo initialized locally
- ⏭️ Next: Push main repo & configure GitHub Secrets

---

## 📋 STEP 1: Create Main Repository & Push Code

### On GitHub:
1. Go to https://github.com/new
2. Create repo name: `ai-task-platform`
3. Make it **Private**
4. ❌ Do NOT initialize README/LICENSE (we have content already)
5. Click "Create repository"

### In Terminal:
```powershell
cd C:\Projects\Internship

# Add GitHub remote
git remote add origin https://github.com/yaswanthkumarrayi/ai-task-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🔐 STEP 2: Configure GitHub Secrets (CRITICAL FOR CI/CD)

### Go to Main Repo Settings:
1. Navigate to: https://github.com/yaswanthkumarrayi/ai-task-platform/settings/secrets/actions
2. Click "New repository secret" and add these 4 secrets:

| Secret Name | Value |
|---|---|
| `DOCKER_USERNAME` | `yaswanth2007` |
| `DOCKER_PASSWORD` | `yash123456` |
| `INFRA_REPOSITORY` | `yaswanthkumarrayi/ai-task-platform-infra` |
| `GH_PAT` | *See below* |

### Create GH_PAT (GitHub Personal Access Token):
1. Go to https://github.com/settings/tokens/new
2. Name: `CI_CD_TOKEN`
3. Expiration: 90 days
4. Check these scopes:
   - ✓ `repo` (full control)
   - ✓ `workflow` (update workflow files)
5. Click "Generate token"
6. Copy the token
7. Add as `GH_PAT` secret in repo settings

---

## 🐳 STEP 3: Trigger CI/CD Pipeline

Once secrets are configured, trigger the workflow:

```powershell
cd C:\Projects\Internship

# Make a small change to trigger CI/CD
git add .
git commit -m "Enable CI/CD pipeline with GitHub secrets"
git push origin main
```

### Watch the workflow:
1. Go to https://github.com/yaswanthkumarrayi/ai-task-platform/actions
2. You should see a workflow running with:
   - ✓ Lint (backend, frontend, worker)
   - ✓ Build & Push Docker images
   - ✓ Update infra repo manifests

---

## ☸️ STEP 4: Deploy to k3s Kubernetes

### Prerequisites:
- k3s running locally (or accessible)
- `kubectl` configured to access k3s cluster
- All K8s manifests in `infra/` directory (already done ✓)

### Deployment Commands:

```bash
# 1. Create namespace
kubectl apply -f infra/k8s/namespace.yaml

# 2. Apply secrets (CRITICAL - contains DB credentials)
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/configmap.yaml

# 3. Deploy data services
kubectl apply -f infra/k8s/mongodb.yaml
kubectl apply -f infra/k8s/redis.yaml

# Wait for them to be ready (30-60 seconds)
kubectl wait --for=condition=ready pod -l app=mongodb -n ai-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n ai-platform --timeout=300s

# 4. Deploy application services
kubectl apply -f infra/k8s/backend.yaml
kubectl apply -f infra/k8s/worker.yaml
kubectl apply -f infra/k8s/frontend.yaml

# 5. Deploy ingress & network policies
kubectl apply -f infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/networkpolicy.yaml
kubectl apply -f infra/k8s/pdb.yaml
```

### Verify Deployment:

```bash
# Check all pods
kubectl get pods -n ai-platform

# Should show:
# NAME                       READY   STATUS    RESTARTS   AGE
# backend-xxxxx              1/1     Running   0          1m
# frontend-xxxxx             1/1     Running   0          1m
# worker-xxxxx               1/1     Running   0          1m
# mongodb-xxxxx              1/1     Running   0          1m
# redis-xxxxx                1/1     Running   0          1m

# Check services
kubectl get svc -n ai-platform

# Check ingress
kubectl get ingress -n ai-platform
```

### Test Backend in k3s:

```bash
kubectl exec -it deployment/backend -n ai-platform -- \
  wget -qO- http://localhost:5000/ready
  
# Expected: {"ready":true,"db":"connected","redis":"connected"}
```

---

## 🌐 STEP 5: Access via Ingress (k3s)

### Add to /etc/hosts:
Windows: `C:\Windows\System32\drivers\etc\hosts`
```
127.0.0.1    ai-platform.local
```

Then access:
- **Frontend**: http://ai-platform.local
- **API**: http://ai-platform.local/api

---

## 🔄 STEP 6: Set Up Argo CD (GitOps Auto-Sync)

### Install Argo CD on k3s:
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for readiness
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=argocd-server \
  -n argocd --timeout=300s
```

### Deploy Argo CD Application:
```bash
kubectl apply -f infra/argocd/app.yaml
```

### Access Argo CD UI:
```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Port-forward to local machine
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access: https://localhost:8080
# Username: admin
# Password: <from-above>
```

### How it works:
1. You push code to `ai-task-platform` main branch
2. CI/CD workflow auto-updates manifests in `ai-task-platform-infra`
3. Argo CD detects changes and auto-syncs to k3s
4. Application updates automatically! 🚀

---

## 📊 Current Credentials (Keep Secure!)

```
JWT_SECRET:         da9d1a2bc556a673c508a5b413120797adc247ebc7d9699b79bcffec4c1384ef
MONGO_USERNAME:     admin
MONGO_PASSWORD:     1a3805becede66bdf0e7793abfdddbc1
REDIS_PASSWORD:     64f7c4d6f1cea86c59cce50f22725076
DOCKER_HUB:         yaswanth2007 / yash123456
GITHUB_USERNAME:    yaswanthkumarrayi
```

⚠️ **IMPORTANT**: Replace these with production values before going live!

---

## 🎯 Test Flow (Local)

While waiting for k3s setup:

1. **Access frontend**: http://localhost:3000
2. **Create account**: Use any email/password
3. **Create task**: 
   - Text: "hello world"
   - Operation: "uppercase"
   - Submit
4. **Watch worker process it**: Dashboard updates every 4 seconds
5. **View result**: Click on task to see logs & output

---

## ❌ Troubleshooting

### K8s pods not starting?
```bash
# Check pod events
kubectl describe pod <pod-name> -n ai-platform

# Check logs
kubectl logs deployment/backend -n ai-platform

# Common issue: Secrets not applied
kubectl get secret -n ai-platform
```

### Ingress not working?
```bash
# Check ingress status
kubectl get ingress -n ai-platform -o wide

# Test DNS
nslookup ai-platform.local
```

### Docker images not pushed?
```bash
# Check if Docker Hub credentials are correct
docker login -u yaswanth2007

# Manually push
docker push yaswanth2007/internship-backend:latest
```

---

## ✅ Deployment Checklist

- [ ] Main repo created on GitHub
- [ ] Main repo pushed with `git push -u origin main`
- [ ] All 4 GitHub Secrets configured
- [ ] CI/CD workflow ran successfully
- [ ] Docker images pushed to Docker Hub
- [ ] Infra repo manifests updated by CI/CD
- [ ] k3s namespace created
- [ ] MongoDB and Redis deployed and healthy
- [ ] Backend, Frontend, Worker deployed
- [ ] Ingress routes traffic correctly
- [ ] Frontend accessible at http://ai-platform.local
- [ ] Argo CD installed and synced
- [ ] Application working end-to-end

---

## 📞 Support

If you hit issues, check:
1. **Backend logs**: `kubectl logs deployment/backend -n ai-platform`
2. **Worker logs**: `kubectl logs deployment/worker -n ai-platform`
3. **Docker Compose still working**: `docker-compose ps`
4. **Secrets configured**: https://github.com/yaswanthkumarrayi/ai-task-platform/settings/secrets/actions

---

**Created**: 2026-04-17
**Status**: Ready for deployment ✅
