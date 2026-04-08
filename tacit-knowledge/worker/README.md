# SkillRelay Worker

Python SQS worker for document processing and indexing.

## Tech Stack

- Python 3.12
- LlamaIndex
- AWS SQS
- PostgreSQL with pgvector

## Setup

### Using Docker (Recommended)

```bash
# From project root
docker-compose up -d worker

# Restart after code changes
docker-compose restart worker
```

### Local Development

```bash
# Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Start worker
uv run python worker.py
```

## Environment Variables

```bash
cp .env.example .env
# Edit .env
```

## Scripts

```bash
# Start worker
./scripts/start_worker.sh

# Stop worker
./scripts/stop_worker.sh

# Restart worker
./scripts/restart_worker.sh
```
