# SkillRelay

An AI-powered knowledge collection and validation system. SkillRelay conducts structured hearings with domain experts, collects their tacit knowledge, and uses AI to validate, organize, and retrieve that knowledge through RAG-based chat.

## Architecture

```
skillrelay/
├── core/           # Rails 8 + React (main web application)
├── ai-server/      # Next.js + Mastra AI SDK (AI inference server)
├── worker/         # Python SQS worker (document processing, plan/QA/manual generation)
├── cloudformation/ # AWS infrastructure (11 CloudFormation templates)
└── docs/           # Architecture docs, operation guides, incident reports
```

## Prerequisites

- Docker & Docker Compose
- External API keys:
  - **OpenAI API Key** — LLM chat (gpt-5-mini) and embeddings (text-embedding-3-small)
  - **Cohere API Key** — Rerank (rerank-multilingual-v3.0)
- **PostgreSQL 16 with pgvector** (provided via Docker Compose for local dev)

## Quick Start

```bash
# 1. Copy environment files
cp core/.env.sample core/.env
cp worker/.env.example worker/.env
# Edit .env files to set OPENAI_API_KEY, AWS credentials, etc.

# 2. Start all services
docker-compose up -d

# 3. Create and migrate database
docker-compose exec app bin/rails db:create
docker-compose exec app bin/rails db:migrate

# 4. Initialize AI Server tables
docker-compose exec ai-server yarn db:init

# 5. Seed initial data (optional)
docker-compose exec app bin/rails db:seed_fu

# 6. Verify services are running
# Core:      http://localhost:3000
# AI Server: http://localhost:8000/api/health
# Worker:    docker-compose logs worker (should show "SQS Worker started")
```

## Services

| Service | Host Port | Container Port | Description | Dependencies |
|---------|-----------|----------------|-------------|-------------|
| app (Core) | 3000 | 3000 | Rails API + React SPA | postgres, ai-server, SQS, S3 |
| ai-server | 8000 | 3000 | AI inference (Mastra agents, RAG) | postgres, S3, OpenAI, Cohere |
| worker | - | - | SQS document processor | postgres, SQS, S3, OpenAI |
| postgres | 5432 | 5432 | PostgreSQL 16 + pgvector | - |

## Service Communication

```
Browser ──SSE streaming──> AI Server (:8000)     Chat responses
Browser ──HTTP──> Core (:3000)                    API requests
Core ──Faraday (30s timeout)──> AI Server (:3000) Server-to-server (container)
Core ──SQS SendMessage──> SQS ──Long Poll──> Worker   Async document processing
```

- **Frontend → AI Server**: Direct SSE connection using Vercel AI SDK. `AI_SERVER_URL` is injected at Docker **build time** via esbuild, not at runtime.
- **Core → AI Server**: Faraday HTTP client with 30s timeout / 10s open timeout.
- **Core → Worker**: Async via SQS. Messages contain `action_type` for routing (e.g., `hearing_create`, `hearing_finish`, `manual_create`).

See [Architecture Overview](docs/architecture-overview.md) for detailed specs.

## Environment Variables

### Core (Rails)

| Variable | Description |
|----------|-------------|
| `VIDEO_URL` | CloudFront signed URL for video |
| `CLOUDFRONT_PRIVATE_KEY_ID` / `CLOUDFRONT_PRIVATE_KEY` | CloudFront signed URL keys |

### AI Server (Next.js)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `COHERE_API_KEY` | Cohere Rerank API key |

### Worker (Python)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `LLM_MODEL` | LLM model name (default: `gpt-5-mini`) |

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Core Backend | Ruby / Rails | 3.4.2 / 8.0+ |
| Core Frontend | React / TypeScript / TailwindCSS | 18.2 / 5+ / 4.x |
| AI Server | Node.js / Next.js / Mastra | 22+ / 16.1 / 1.1.0 |
| Worker | Python / LlamaIndex | 3.12 |
| Database | PostgreSQL + pgvector | 16 |
| LLM | OpenAI GPT-5-mini | - |
| Embedding | text-embedding-3-small (1536 dim) | - |
| Rerank | Cohere rerank-multilingual-v3.0 | - |
| Infra | AWS App Runner, ECS Fargate, RDS, SQS, S3, CloudFront | - |
| IaC | CloudFormation (11 templates) | - |
| CI/CD | GitHub Actions | - |

## Deploy

| Environment | Trigger | Flow |
|-------------|---------|------|
| **Production** | Push to `main` | Change detection → Docker build → ECR push → App Runner auto-deploy / ECS force deploy |
| **Preview** | Push to `mock/*` | Docker build → ECR push → CloudFormation stack (isolated DB + App Runner + ECS) |
| **CI** | Pull request | RuboCop + Brakeman → Rails test → JS build |

See [Architecture Overview — Deploy Flow](docs/architecture-overview.md#デプロイフロー) for details.

## Common Commands

```bash
# Start specific services
docker-compose up -d app
docker-compose up -d worker
docker-compose up -d ai-server

# Enter Rails container
docker-compose exec app bash

# View logs
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f ai-server

# Stop all services
docker-compose down
```

## Documentation

See [`docs/`](docs/README.md) for full documentation including:

- [Architecture Overview](docs/architecture-overview.md) — Service communication, infra specs, config values, design decisions
- [Data Flow](docs/data-flow.md) — Chat, RAG, and document processing flows
- [Preview Operations Guide](docs/preview-operations-guide.md) — mock branch deployment
- [Incident Reports](docs/incidents/) — Past incidents and lessons learned
