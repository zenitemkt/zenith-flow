#!/bin/sh
set -eu

if [ "${VERCEL_ENV:-}" = "production" ]; then
  if [ "${VERCEL_GIT_COMMIT_MESSAGE:-}" = "Executa recuperação temporária da migration" ]; then
    npm run migrate:recover-google-business --workspace=packages/db
  fi
  npm run migrate:deploy --workspace=packages/db
fi

npm run build --workspace=apps/web
