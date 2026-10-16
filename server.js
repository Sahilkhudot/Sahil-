const express = require("express");
const path = require("path");
const os = require("os");
const fs = require("fs");
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
      error: "Please enter a valid Instagram URL."
    });
  }

  if (["story", "highlight"].includes(kind)) {
    return res.status(400).json({
      error: "Stories and Highlights are not supported."
    });
  }

  return res.json({
    message: "Your media is ready to retrieve.",
    downloadUrl: "/api/file?url=" + encodeURIComponent(url)
  });
});

app.get("/api/file", async (req, res) => {
  const url = req.query.url;

  if (!validInstagramUrl(url)) {
    return res.status(400).send("Invalid Instagram URL.");
  }

  let tempDir;

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "speedx999-"));

    const ffmpegPath = (
      await new Promise((resolve, reject) => {
        const p = spawn("python3", [
          "-c",
          "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
        ]);

        let output = "";
        p.stdout.on("data", d => output += d.toString());
        p.on("error", reject);
        p.on("close", code => {
          if (code === 0 && output.trim()) resolve(output.trim());
          else reject(new Error("FFmpeg package not available"));
        });
      })
    );

    const outputTemplate = path.join(tempDir, "media.%(ext)s");

    await new Promise((resolve, reject) => {
      const downloader = spawn("python3", [
        "-m", "yt_dlp",
        "--no-playlist",
        "--no-warnings",
        "--ffmpeg-location", ffmpegPath,
        "-f", "bestvideo+bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", outputTemplate,
        url
      ]);

      let errors = "";
      downloader.stderr.on("data", d => errors += d.toString());
      downloader.on("error", reject);
      downloader.on("close", code => {
        if (code === 0) resolve();
        else reject(new Error(
          "Instagram could not provide the video and audio. The media may be private or unavailable."
        ));
      });
    });

    const files = fs.readdirSync(tempDir)
      .filter(name => !name.endsWith(".part"));

    const videoFile = files.find(name =>
      /\.(mp4|mkv|webm|mov)$/i.test(name)
    );

    if (!videoFile) {
      throw new Error("No completed video file was created.");
    }

    const filePath = path.join(tempDir, videoFile);

    res.download(filePath, "SPEEDx999.mp4", async () => {
      try {
        await fs.promises.rm(tempDir, {
          recursive: true,
          force: true
        });
      } catch {}
    });

    res.on("close", () => {
      fs.promises.rm(tempDir, {
        recursive: true,
        force: true
      }).catch(() => {});
    });
  } catch (err) {
    console.error("Download error:", err.message);

    if (tempDir) {
      fs.promises.rm(tempDir, {
        recursive: true,
        force: true
      }).catch(() => {});
    }

    if (!res.headersSent) {
      res.status(502).send(
        "Download failed. Check the Render logs. Instagram may have blocked the media."
      );
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SPEED×999 running on port ${PORT}`);
});
