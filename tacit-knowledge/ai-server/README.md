# SkillRelay AI Server

Next.js AI inference server using Mastra AI SDK.

## Tech Stack

- Next.js 16 (App Router)
- Mastra AI SDK
- Vercel AI SDK
- OpenAI GPT-4.1
- PostgreSQL with pgvector

## Setup

### Setup Mastra tables
```bash
yarn db:init
```

### Using Docker (Recommended)

```bash
# From project root
docker-compose up -d ai-server
```

### Local Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev
```

## Environment Variables

```bash
cp .env.example .env
# Edit .env
```

## API Endpoints

- `POST /api/chat` - Default chat
- `POST /api/hearing` - Hearing chat
- `POST /api/validation` - Validation chat
- `POST /api/topic` - Topic chat

## Access

- http://localhost:8000
