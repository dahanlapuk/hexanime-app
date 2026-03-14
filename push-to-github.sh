#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# HexAnime — First Push to GitHub
# ─────────────────────────────────────────────
# Usage:
#   chmod +x push-to-github.sh
#   ./push-to-github.sh
#
# Before running, replace YOUR_USERNAME below
# with your actual GitHub username.
# ─────────────────────────────────────────────

REPO_NAME="hexanime-app"
GITHUB_USER="YOUR_USERNAME"  # ← GANTI INI dengan username GitHub lu
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "⬡ HexAnime — Preparing first push to GitHub"
echo "  Remote: ${REMOTE_URL}"
echo ""

# ── Safety check: no .env files ──
if [ -f ".env" ]; then
  echo "⚠️  WARNING: .env file detected!"
  echo "   Make sure .gitignore excludes it before pushing."
  echo "   Current .gitignore includes .env: $(grep -c '\.env' .gitignore 2>/dev/null || echo '0') entries"
  echo ""
fi

# ── Init fresh Git repo ──
if [ ! -d ".git" ]; then
  echo "📦 Initializing fresh Git repository..."
  git init
  git branch -M main
else
  echo "📦 Git repo already initialized, skipping init."
fi

# ── Stage all files ──
echo "📋 Staging files..."
git add .

# ── Show what will be committed ──
echo ""
echo "📊 Files staged for commit:"
git diff --cached --stat
echo ""

# ── Commit ──
COMMIT_MSG="feat: initial hexanime-app setup

- React 19 + Vite 6 + TypeScript + Tailwind v4
- 11 Monogatari series, 117 episodes with GDrive file_ids
- Download manager with queue, pause/resume
- Player with split-episode chain (01a→01b)
- Startup storage audit
- GitHub Actions CI for Android APK"

echo "💾 Creating initial commit..."
git commit -m "${COMMIT_MSG}"

# ── Add remote ──
if git remote get-url origin &>/dev/null; then
  echo "🔗 Remote 'origin' already set, updating..."
  git remote set-url origin "${REMOTE_URL}"
else
  echo "🔗 Adding remote origin..."
  git remote add origin "${REMOTE_URL}"
fi

# ── Push ──
echo ""
echo "🚀 Pushing to ${REMOTE_URL}..."
echo "   Run: git push -u origin main"
echo ""
echo "   If this is your first push, execute manually:"
echo "   git push -u origin main"
echo ""
echo "✅ Done! Repository is ready."
