# OddSockets Svelte SDK - two-client round-trip demo
#
# Build from the repo ROOT so the SDK source is in context (the demo installs
# the SDK via an npm path dependency - "oddsockets-svelte": "file:.." - so it
# builds straight from the parent, without publishing anything):
#
#   docker build -f demo/Dockerfile -t oddsockets-svelte-demo .
#   docker run --rm -e ODDSOCKETS_API_KEY="ak_your_key_here" oddsockets-svelte-demo
#
# A successful run prints "OK - cross-client round-trip verified" and exits 0.

FROM node:20-slim

WORKDIR /sdk
COPY . /sdk

# Install the SDK's own runtime deps (socket.io-client, eventemitter3) at the
# repo root, because Node resolves src/*.js imports from /sdk/node_modules.
# svelte is a peerDependency (the package entrypoint re-exports the reactive
# stores, which import it); a consuming app supplies it, so the demo does too.
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps \
 && npm install svelte@^4 --no-save --no-audit --no-fund --legacy-peer-deps

# Then install the demo, which links the SDK from the parent (file:..).
WORKDIR /sdk/demo
RUN npm install --no-audit --no-fund

CMD ["node", "demo.mjs"]
