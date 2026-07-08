FROM alpine:latest AS runtime
WORKDIR /app

RUN apk add --no-cache nodejs pnpm git
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .
RUN pnpm install
COPY . .
ARG CI_COMMIT_SHA=dev
ENV CI_COMMIT_SHA=$CI_COMMIT_SHA
RUN pnpm build

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
