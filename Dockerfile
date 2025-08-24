# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.3.0
FROM ruby:$RUBY_VERSION-slim AS dev

WORKDIR /rails

# Install system packages including PostgreSQL client
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      curl \
      gnupg \
      postgresql-client \
      libjemalloc2 \
      libvips \
      build-essential \
      libpq-dev \
      git \
      libyaml-dev \
      pkg-config \
      vim less && \
    # Install Node.js (v20 LTS)
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install --no-install-recommends -y nodejs && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Set environment variables
ENV RAILS_ENV=development \
    NODE_ENV=development \
    BUNDLE_PATH="/usr/local/bundle" \
    npm_config_build_from_source=true \
    npm_config_target_platform=linux \
    npm_config_target_arch=x64

# Copy Gemfiles and install gems
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Copy package.json and install Node packages
COPY package.json package-lock.json* ./
RUN npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install

# Copy all code (or mount in docker-compose override)
COPY . .

# Expose ports
EXPOSE 3000

# Use bash for easier debugging
SHELL ["/bin/bash", "-c"]

# Run Rails server by default
CMD ["bin/dev"]