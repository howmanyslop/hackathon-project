# syntax=docker/dockerfile:1
# The web app's container image. Build it from the repository root:
#
#   docker buildx build --platform linux/amd64 -f apps/web/Dockerfile .
#
# `mise run k8s:deploy` does this, pushes the image, and deploys it.

# The build stage runs on the builder's own CPU, which is fast on Apple
# silicon. Its output is plain JavaScript, so the amd64 runtime stage below
# uses it as is.
FROM --platform=$BUILDPLATFORM node:26-slim AS build
ENV CI=true
WORKDIR /repo
COPY package.json ./
RUN npm install --global "$(node --print 'require("./package.json").packageManager')"
COPY . .
# Install and build in one step: pnpm's global virtual store links
# node_modules into the cache mount, which only exists during this step.
# The speech model is git-ignored. Files already in the build context are
# checked and kept; missing ones are downloaded and checked against their
# SHA-256. A failed download must not block a deploy: the app then runs
# without the on-device fallback, and says so on phones that need it.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
	pnpm install --frozen-lockfile --store-dir /pnpm-store --filter "@web-template/web..." \
	&& (pnpm --filter @web-template/web run speech-model:fetch \
		|| echo "WARNING: the speech model is missing, so this image has no on-device fallback") \
	&& pnpm --filter @web-template/web run build

# Only the files this repository adds to the image. `mise run k8s:deploy`
# exports this stage and scans it for secrets before anything is pushed.
FROM scratch AS app-files
COPY --from=build /repo/apps/web/.output /.output
COPY --from=build /repo/apps/web/drizzle /drizzle

# Nitro bundles every dependency into `.output`, so no `node_modules` here.
FROM node:26-slim AS runtime
# Links the ghcr.io package to the repository on GitHub.
LABEL org.opencontainers.image.source="https://github.com/howmanyslop/hackathon-project"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.output ./.output
# The app applies these at startup (src/db/migrate.ts).
COPY --from=build --chown=node:node /repo/apps/web/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
