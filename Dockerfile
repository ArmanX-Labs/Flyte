# ---------------------------------------------------
# Stage 1: Build Frontend Assets (Vite / React)
# ---------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------
# Stage 2: Build Rust Backend
# ---------------------------------------------------
FROM ubuntu:22.04 AS backend-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    wget \
    file \
    pkg-config \
    libssl-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust stable toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy dependency manifests and build configs
COPY Cargo.toml Cargo.lock build.rs tauri.conf.json ./

# Dummy frontend dist & dummy src to pre-cache crates dependencies
RUN mkdir -p src frontend/dist && \
    touch frontend/dist/index.html && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release || true

# Copy real frontend build for tauri-build verification
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy application icons and source code
COPY icons/ ./icons/
COPY src/ ./src/
RUN touch src/main.rs && cargo build --release

# ---------------------------------------------------
# Stage 3: Minimal Runtime Container
# ---------------------------------------------------
FROM ubuntu:22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libgtk-3-0 \
    libwebkit2gtk-4.0-37 \
    libayatana-appindicator3-1 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from backend builder
COPY --from=backend-builder /app/target/release/mycloud /app/mycloud

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Default environment configuration for production
ENV SERVER_ONLY=1
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV FRONTEND_DIST=/app/frontend/dist

# Persistent volume mount point for SQLite databases & Telegram sessions
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["/app/mycloud"]
