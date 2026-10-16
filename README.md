# SPEED×999 Instagram Downloader

A dark neon-green, mobile-first website for attempting downloads from eligible **public** Instagram reel/post/story URLs.

## Run locally
1. Install Node.js 20+ and Python 3.
2. In this folder run:
   ```bash
   npm install
   pip install yt-dlp
   npm start
   ```
3. Open http://localhost:3000

## Deploy free on Render
1. Create a GitHub repository and upload these project files.
2. In Render, choose **New + → Web Service**, connect the repository.
3. Use build command: `npm install && pip install yt-dlp`
4. Use start command: `npm start`
5. Deploy and open the URL Render gives you.

A `render.yaml` is included as a starting point. Free hosting limits and platform policies can change.

## Important limitations
- Instagram changes its systems frequently. yt-dlp may fail even for public links; this is not a guaranteed downloader.
- Highlights and login-protected stories are not supported in this public-link version. Do not add Instagram passwords, session cookies, or private-account bypasses.
- Download only content you own or have permission to save, and follow Instagram's terms and copyright law.
- This starter is not production-hardened: add rate limiting, file cleanup, request logging controls, and abuse protection before public launch.
