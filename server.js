const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

function validInstagramUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      ["instagram.com", "www.instagram.com"].includes(u.hostname) &&
      /^\/(reel|reels|p|tv|stories)\//.test(u.pathname)
    );
  } catch {
    return false;
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/download", (req, res) => {
  const { url, kind } = req.body || {};

  if (!validInstagramUrl(url)) {
    return res.status(400).json({
      error: "Please enter a valid Instagram post, reel, or story URL."
    });
  }

  if (["story", "highlight"].includes(kind)) {
    return res.status(400).json({
      error: "Stories and Highlights may require login and are not supported by this public downloader."
    });
  }

  res.json({
    message: "Link checked. Tap below to retrieve the media.",
    downloadUrl: "/api/file?url=" + encodeURIComponent(url)
  });
});

app.get("/api/file", (req, res) => {
  const url = req.query.url;

  if (!validInstagramUrl(url)) {
    return res.status(400).send("Invalid Instagram URL.");
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="SPEEDx999-download.mp4"'
  );

  const downloader = spawn("python3", [
    "-m", "yt_dlp",
    "--no-playlist",
    "--no-warnings",
    "-f", "bestvideo+bestaudio/best",
"--merge-output-format", "mp4",
    "-o", "-",
    url
  ]);

  let started = false;

  downloader.stdout.on("data", () => {
    started = true;
  });

  downloader.stderr.on("data", (chunk) => {
    console.error("yt-dlp:", chunk.toString());
  });

  downloader.on("error", (err) => {
    console.error(err);
    if (!res.headersSent) res.status(500);
    res.end("Downloader could not start. Check the Render logs.");
  });

  downloader.on("close", (code) => {
    if (code !== 0 && !started && !res.headersSent) {
      res.status(502).send(
        "Instagram could not provide this media. It may be private, restricted, or temporarily unavailable."
      );
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  req.on("close", () => {
    if (!res.writableEnded) downloader.kill();
  });

  downloader.stdout.pipe(res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SPEED×999 running on port ${PORT}`);
});
