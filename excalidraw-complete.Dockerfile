# Frontend build stage
FROM --platform=$BUILDPLATFORM node:18 AS frontend-builder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=3072
# Copy excalidraw submodule (must be initialized: git submodule update --init excalidraw)
COPY excalidraw/ ./excalidraw/
# Overlay Pi-specific frontend patches
COPY excalidraw-patches/index.html excalidraw/excalidraw-app/index.html
COPY excalidraw-patches/firebase.ts excalidraw/excalidraw-app/data/firebase.ts
COPY excalidraw-patches/time.ts excalidraw/excalidraw-app/utils/time.ts
COPY excalidraw-patches/AI.tsx excalidraw/excalidraw-app/components/AI.tsx
COPY excalidraw-patches/MyCreationsTab.tsx excalidraw/excalidraw-app/components/MyCreationsTab.tsx
COPY excalidraw-patches/useCanvasManagement.ts excalidraw/excalidraw-app/hooks/useCanvasManagement.ts
# Build frontend
RUN cd excalidraw && npm install -g pnpm && pnpm install && cd excalidraw-app && DISABLE_VITE_CHECKER=true pnpm build:app:docker

# Backend build stage
FROM --platform=$BUILDPLATFORM golang:alpine AS backend-builder
RUN apk update && apk add --no-cache git
WORKDIR /app
ARG TARGETOS
ARG TARGETARCH
# Copy Go module files
COPY go.mod go.sum ./
RUN go mod download
# Copy source code
COPY . .
# Copy frontend build output so Go embed can find it
COPY --from=frontend-builder /app/excalidraw/excalidraw-app/build ./frontend/
# Build Go binary
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o main .

# Final runtime image
FROM --platform=$TARGETPLATFORM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
# Copy backend binary (includes embedded frontend)
COPY --from=backend-builder /app/main .
EXPOSE 3002
CMD ["./main"]
