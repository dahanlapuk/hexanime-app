# ⬡ HexAnime

**Personal Anime Library Manager** — A Netflix-inspired offline anime library built for the Monogatari Series.

![Build](https://github.com/YOUR_USERNAME/hexanime-app/actions/workflows/android-build.yml/badge.svg)

---

## Overview

HexAnime is a personal anime library manager designed for offline viewing on Android tablets. It provides:

- 🎬 **Netflix-style UI** — Hero banners, series cards with gradient covers, and kanji watermarks
- 📺 **Dual Watch Order** — Toggle between TV Release and Chronological viewing order
- ⬇️ **GDrive Download Manager** — Batch download episodes from Google Drive with queue, pause/resume
- ▶️ **Seamless Player** — Auto-next episode, split-episode chaining (01a → 01b), resume playback
- 🔍 **Storage Audit** — Startup integrity check ensures downloaded files haven't been manually deleted
- 📱 **Capacitor-ready** — Wraps as a native Android APK for tablet deployment

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Framework   | React 19 + TypeScript             |
| Build       | Vite 6                            |
| Styling     | Tailwind CSS v4                   |
| Routing     | React Router DOM v7               |
| Native      | Capacitor (Android)               |
| Storage     | localStorage + Capacitor FS       |
| CI/CD       | GitHub Actions → Debug APK        |

---

## Setup Instructions

### Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- Android Studio (for Capacitor builds)
- Java 17 (for Gradle)

### Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/hexanime-app.git
cd hexanime-app

# Install dependencies
npm install

# Start dev server
npm run dev
# Open http://localhost:5173/
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_GDRIVE_API_KEY=your_google_drive_api_key_here
```

> ⚠️ **Never commit `.env` files.** The `.gitignore` already excludes them.

### Android Build (Local)

```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Or build via CLI
cd android && ./gradlew assembleDebug
```

### Android Build (CI)

Push to `main` branch → GitHub Actions automatically builds and uploads the debug APK as a downloadable artifact.

---

## Project Structure

```
hexanime-app/
├── src/
│   ├── components/    # Navbar, Hero, SeriesCard, StatusPill
│   ├── pages/         # HomePage, DetailPage, PlayerPage
│   ├── hooks/         # useStore, useDownloadManager
│   ├── data/          # metadata.ts (series info + watch orders)
│   ├── types/         # TypeScript interfaces
│   ├── App.tsx        # Router + startup audit
│   └── index.css      # Tailwind v4 theme
├── public/
│   └── library.json   # 117 episodes, 11 series (with GDrive file_ids)
├── android/           # Capacitor Android project
└── .github/workflows/ # CI/CD pipeline
```

---

## License

Private project — not for redistribution.
