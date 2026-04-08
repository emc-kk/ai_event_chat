# syntax = docker/dockerfile:1

# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies only
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Copy project files and install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

# Runtime stage
FROM python:3.12-slim

WORKDIR /app

# Install only runtime dependencies (no build tools)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    libpq5 \
    poppler-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Copy uv from builder stage
COPY --from=builder /root/.local/bin/uv /usr/local/bin/uv

# Copy installed dependencies from builder stage
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/pyproject.toml /app/uv.lock ./

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

CMD ["uv", "run", "python", "-u", "worker.py"]
