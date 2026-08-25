# Vocabulary Master

A Vite/Tauri vocabulary and classroom practice app for teacher-managed content, student activities, local desktop packaging, and Supabase-backed cloud sync when online.

## Features
- **Teacher Mode**: Manage vocabulary, classroom activities, quizzes, students, schedules, and exports.
- **Student Mode**: Practice vocabulary, complete classroom activities, play arcade games, and track progress.
- **Desktop + Web Build**: Vite builds the shared web app into `dist-desktop`, which Tauri packages for desktop distribution.
- **Online Sync + Offline Fallbacks**: Supabase powers auth/cloud data while bundled local assets keep the desktop app usable when offline.

## How to Run Locally

### Project Helper
Use `./planner` for the student/teacher split:

```bash
./planner run student
./planner run teacher
./planner build student
./planner build teacher
./planner preview student
./planner deploy teacher
```

`deploy` builds `dist-desktop` and only uploads if `PLANNER_DEPLOY_CMD` is set.
By default, `run student` uses port 8000 and `run teacher` uses port 8001.
Local `run` uses Vite so bundled tools like the activities canvas editor load the same way they will in the desktop and hosted builds.

### Option 1: Using the Launcher
1.  Double-click `start_app.command` in the project folder.
2.  This starts the student app with Vite and opens your browser to `http://127.0.0.1:8000/student.html`.

### Option 2: Manual Server
If you prefer the terminal:
```bash
npm install
./planner run student
./planner run teacher
# Then open http://127.0.0.1:8001/teacher.html
```

*Note: Opening `index.html` directly, or serving the repo with a raw Python server, may cause issues with bundled editor tools and browser security policies.*

## Testing

Run the complete source regression suite:

```bash
npm test
```

Run a credential-free smoke test for the basic home, student, and teacher shells:

```bash
npm run test:ui:smoke
```

Run the same shell smoke against the built desktop web output:

```bash
npm run test:ui:smoke:dist
```

Run the local authenticated release smoke. This starts or reuses local Supabase, seeds local-only audit users, points the browser at the local Supabase API, submits seeded classroom activities, and checks teacher review:

```bash
npm run test:ui:auth-smoke
```

Local audit users are recreated idempotently:

```text
Teacher: audit.teacher@aid.edu.pa
Student: audit.student@aid.edu.pa
Password: AuditPass123!
```

Run the responsive audit against the same local seeded users:

```bash
npm run test:ui:responsive:local
```

Run the responsive audit against existing hosted test accounts when credentials are available:

```bash
UI_AUDIT_TEACHER_EMAIL="teacher@example.com" \
UI_AUDIT_STUDENT_EMAIL="student@example.com" \
UI_AUDIT_PASSWORD="password" \
npm run test:ui:responsive
```

Run the release hardening suite:

```bash
npm run test:release
```

The release suite runs the complete source regression suite, production dependency audit, source and built-preview shell smoke, local authenticated and responsive checks, cross-browser smoke, Supabase acceptance/lint/advisor checks, and the desktop web build. It intentionally does not run `npm audit fix`; dependency upgrades must pass the same release gates.

## Desktop App

This project can also be packaged as a Windows/Mac desktop app with Tauri.

```bash
npm install
npm run desktop:build
```

The default local build creates a macOS app bundle at:

```text
src-tauri/target/release/bundle/macos/Vocabulary Master.app
```

Additional package targets:

```bash
npm run desktop:build:mac-dmg
npm run desktop:build:windows
```

The desktop build bundles the app shell, local fonts/icons, core JavaScript, vocabularies, games, and other runtime assets. Cloud content and progress sync through Supabase when the device is online.

## Building Games

Playable game output is tracked and validated by the production build. The following source projects also provide developer rebuild scripts when their source changes:
- **JS13K 2021**
- **Callisto**
- **Glitch Buster**

### Option 1: Double-Click (Recommended)
1. Double-click `build-games.command` in the project folder.
2. A Terminal window will open and build all games.
3. The window will stay open so you can see the results.

### Option 2: Command Line
If you prefer the terminal:
```bash
./build-games.sh
```

**Note**: If you encounter npm permission errors, fix them with:
```bash
sudo chown -R $(whoami) ~/.npm
```

The normal application build does not require rebuilding unchanged game source.

## Teacher Instructions

### Creating a New Vocabulary Set
1.  Go to **Teacher Mode**.
2.  Fill in the Unit details (ID, Name, etc.).
3.  Add words. For images, enter the path relative to the repo root (e.g., `images/unit1/cat.png`).
4.  Click **Export JSON**.

### Adding Images
1.  Add your image files to the `images/` folder in the repository (organize by unit folders).
2.  Push the images to GitHub.
3.  Use the path `images/folder/filename.png` in the Teacher interface.

### Publishing
1.  Push this code to a GitHub repository.
2.  Go to **Settings > Pages**.
3.  Set the source to **GitHub Actions**.
4.  The included Pages workflow builds `dist-desktop` and publishes that output.
5.  Your site will be live at `https://<username>.github.io/<repo-name>/`.
