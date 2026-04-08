# SkillRelay Core

Rails 8 + React web application for SkillRelay.

## Tech Stack

- Ruby 3.4.2 / Rails 8.0
- React 18 with TypeScript
- PostgreSQL with pgvector
- TailwindCSS 4.x
- esbuild

## Setup

### Using Docker (Recommended)

```bash
# From project root
docker-compose up -d app

# Enter container
docker-compose exec app bash

# Database setup
bin/rails db:create
bin/rails db:migrate
bin/rails db:seed_fu
```

### Local Development

```bash
# Install dependencies
bundle install
yarn install

# Database setup
bin/rails db:create
bin/rails db:migrate

# Start server
bin/dev
```

## Development

```bash
# Build assets
yarn build

# Watch mode
yarn watch

# Rails console
bin/rails console

# Generate controllers/models
bin/rails generate controller NAME
bin/rails generate model NAME
```

## Access

- http://localhost:3000
