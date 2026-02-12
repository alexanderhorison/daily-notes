#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: ./scripts/connect-github.sh <github-repo-url> [branch]"
  echo "Example: ./scripts/connect-github.sh git@github.com:your-org/today-reminders.git main"
  exit 1
fi

REPO_URL="$1"
BRANCH="${2:-main}"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git branch -M "$BRANCH"
git push -u origin "$BRANCH"

echo "Connected and pushed to $REPO_URL on branch $BRANCH"
