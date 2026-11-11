# ==============================================================================
# Build stage: official Bun image (public on Docker Hub, no registry login)
# ==============================================================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependency manifests and install with the frozen lockfile
COPY package.json bun.lock tsconfig.json tsconfig.types.json ./
RUN bun install --frozen-lockfile

# Copy source and compile standalone binaries for the server and the seeder
COPY src/ ./src/
RUN bun build src/index.ts --compile --minify --outfile /app/server && \
    bun build src/seed.ts --compile --minify --outfile /app/seed

# ==============================================================================
# Runtime stage: Google distroless (glibc + libstdc++, no shell, non-root).
# Bun standalone binaries link glibc dynamically, so `scratch` will not work.
# ==============================================================================
FROM gcr.io/distroless/cc-debian12:nonroot AS runner

WORKDIR /app

COPY --from=builder /app/server /app/server
COPY --from=builder /app/seed /app/seed

ENV PORT=3000 \
    NODE_ENV=production

EXPOSE 3000

USER nonroot

ENTRYPOINT ["/app/server"]
