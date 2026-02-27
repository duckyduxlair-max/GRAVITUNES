# Anti-Gravity Music Player Deployment Guide

Since the frontend is a standard React SPA and the backend requires system packages (ffmpeg, yt-dlp, python3), they must be hosted separately.

## 1. Deploying the Backend to Render (Free Tier)

Render allows custom Docker containers for free tiers, which is perfect since we need to install `ffmpeg` and `yt-dlp` alongside Node.js.

### Steps:
1. Push your entire project folder to a **GitHub repository**.
2. Go to **Render.com** and sign in with GitHub.
3. Click **New +** and select **Web Service**.
4. Connect the GitHub repository you just created.
5. In the settings:
   - **Name**: `anti-gravity-backend`
   - **Root Directory**: `server`
   - **Environment**: Select **Docker** (This is critical. Render will automatically detect the `Dockerfile` inside the `server` folder).
   - **Instance Type**: Select the **Free** tier.
6. Click **Create Web Service**. 
   *Note: Render free tiers spin down after 15 minutes of inactivity. When you open the app after a break, the first search/download may take 30-50 seconds while the server wakes up.*

7. Once the build finishes, Render will give you a backend URL (e.g. `https://anti-gravity-backend.onrender.com`). **Copy this URL**.

---

## 2. Deploying the Frontend to Vercel (Free Tier)

Vercel is the best and fastest place to host Vite/React frontends. It handles our custom `vercel.json` routing automatically.

### Steps:
1. Go to **Vercel.com** and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import the exact same GitHub repository.
4. In the "Configure Project" screen:
   - **Framework Preset**: Make sure it says **Vite**.
   - **Root Directory**: Leave it at the default (`./` or the root of the project).
   - Expand the **Environment Variables** section.
5. **CRITICAL STEP**: Add an Environment Variable so the frontend knows where the Render backend is.
   - **Name**: `VITE_API_URL`
   - **Value**: The Render URL you copied earlier (e.g. `https://anti-gravity-backend.onrender.com`)
6. Click **Deploy**.

Vercel will give you a live frontend link (e.g., `https://music-test-vite.vercel.app`). 

---

## 3. Install on Your Phone

1. Open your new Vercel frontend URL on your phone's browser (Safari or Chrome).
2. Tap the **Share** button (iOS) or **Menu** button (Android).
3. Select **"Add to Home Screen"**.
4. The app will install as a native fullscreen PWA on your phone, connected to your live Render backend!
