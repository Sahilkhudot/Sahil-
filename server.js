const express = require("express");
const path = require("path");
const { execFile } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const OUT = path.join(__dirname, "downloads");
fs.mkdirSync(OUT, { recursive: true });
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const allowedHosts = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
function validInstagramUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && allowedHosts.has(u.hostname) &&
      /^\/(reel|reels|p|tv|stories|s)\//.test(u.pathname);
  } catch { return false; }
}
function runYtDlp(url, output) {
  return new Promise((resolve, reject) => {
    // yt-dlp is installed as a project dependency; no Instagram credentials are accepted.
    execFile("yt-dlp", [
      "--no-warnings", "--no-playlist", "--max-filesize", "100M",
      "--socket-timeout", "15", "--retries", "1",
      "-f", "best[ext=mp4]/best",
      "-o", output, url
    ], { timeout: 90000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error("Instagram could not provide this media. It may be private, expired, restricted, or unsupported."));
      resolve();
    });
  });
}
app.post("/api/download", async (req, res) => {
  const { url, kind } = req.body || {};
  if (!validInstagramUrl(url || "")) return res.status(400).json({ error: "Enter a valid HTTPS Instagram reel, post, or story link." });
  if (!["reel", "post", "story", "highlight"].includes(kind)) return res.status(400).json({ error: "Choose a supported media type." });
  if (kind === "highlight") return res.status(400).json({ error: "Instagram highlights commonly require authentication and are not supported by this public-link version." });
  if (kind === "story" && !/\/stories\//.test(new URL(url).pathname)) return res.status(400).json({ error: "For Stories, paste a story URL." });
  if (kind === "reel" && !/\/(reel|reels)\//.test(new URL(url).pathname)) return res.status(400).json({ error: "For Reels, paste a reel URL." });
  if (kind === "post" && !/\/(p|tv)\//.test(new URL(url).pathname)) return res.status(400).json({ error: "For Posts, paste a post URL." });

  const id = crypto.randomBytes(12).toString("hex");
  const output = path.join(OUT, `${id}.%(ext)s`);
  try {
    await runYtDlp(url, output);
    const file = fs.readdirSync(OUT).find(f => f.startsWith(id + "."));
    if (!file) throw new Error("No downloadable media file was returned.");
    res.json({ message: "Your file is ready.", downloadUrl: `/downloads/${encodeURIComponent(file)}` });
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});
app.use("/downloads", express.static(OUT, {
  setHeaders(res) { res.setHeader("Content-Disposition", "attachment"); }
}));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`SPEED×999 running on port ${PORT}`));
