# ==============================================================================
# Build Stage: Chainguard Bun developer image (zero CVE, hardened)
# ==============================================================================
FROM cgr.dev/chainguard/bun:latest-dev AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock tsconfig.json tsconfig.types.json ./

# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Compile standalone self-contained binaries for server and seeder
RUN bun build src/index.ts --compile --minify --outfile /app/server && \
    bun build src/seed.ts --compile --minify --outfile /app/seed

# ==============================================================================
# Runtime Stage: Chainguard minimal glibc-dynamic runtime
# Note: Bun standalone binaries dynamically link libc/ld-linux (incompatible
# with empty 'scratch' image which lacks /lib64/ld-linux-x86-64.so.2).
# cgr.dev/chainguard/glibc-dynamic is Chainguard's minimal ~14MB distroless image
# containing only glibc, non-root user, and root certificates.
# ==============================================================================
FROM cgr.dev/chainguard/glibc-dynamic:latest AS runner

WORKDIR /app

# Copy compiled standalone binaries from builder
COPY --from=builder /app/server /app/server
COPY --from=builder /app/seed /app/seed

# Expose HTTP port
EXPOSE 3000

# Run as Chainguard non-root user (UID 65532)
USER nonroot

ENV PORT=3000 \
    NODE_ENV=production

ENTRYPOINT ["/app/server"]
