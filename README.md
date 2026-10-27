# Fitness Coach

A browser-based fitness coaching app built with React 19, TypeScript, and Vite. It brings workout planning, nutrition, posture, vision, voice, and coaching tools into one interface. On-device AI features use the RunAnywhere Web SDK; vision features use MediaPipe Tasks Vision.

## Run locally

The app source is in `Health-Fitness-Coach-main/`:

    cd Health-Fitness-Coach-main
    npm install
    npm run dev

Open the URL printed by Vite. Allow camera or microphone access when using the related features. Model downloads may be required on first use and can be cached by the browser.

## Build and preview

    npm run build
    npm run preview

## Source layout

- `src/App.tsx`: application shell and navigation
- `src/components/`: coaching, plan, workout, nutrition, posture, vision, and voice views
- `src/runanywhere.ts`: SDK initialization and model catalog
- `src/hooks/`: model loading state
- `vercel.json`: deployment headers/configuration

See `Health-Fitness-Coach-main/README.md` for the original RunAnywhere SDK overview.
