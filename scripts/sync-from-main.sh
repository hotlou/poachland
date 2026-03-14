#!/bin/bash
set -e

echo "Fetching latest from origin..."
git fetch origin

echo "Current branch:"
git branch --show-current

echo "Merging origin/main into current branch..."
git merge origin/main --no-edit

echo "Sync complete."
