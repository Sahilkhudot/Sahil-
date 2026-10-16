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

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let output = "";
    let errors = "";

    child.stdout.on("data", d => output += d.toString());
    child.stderr.on("data", d => errors += d.toString());
    child.on("error", reject);

    child.on("close", code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(errors || "Command failed"));
    });
  });
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

    const ffmpegPath = await run("python3", [
      "-c",
      "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
    ]);

    const template = path.join(tempDir, "media.%(ext)s");

    await run("python3", [
      "-m", "yt_dlp",
      "--no-playlist",
      "--no-warnings",
      "--ffmpeg-location", ffmpegPath,
      "-f", "bestvideo+bestaudio/best",
      "--merge-output-format", "mp4",
      "-o", template,
      url
    ]);

    const files = fs.readdirSync(tempDir);
    const filename = files.find(name => /\.mp4$/i.test(name));

    if (!filename) {
      throw new Error("MP4 file was not created.");
    }

    const filePath = path.join(tempDir, filename);

    res.download(filePath, "SPEEDx999.mp4", err => {
      fs.promises.rm(tempDir, {
        recursive: true,
        force: true
      }).catch(() => {});

      if (err) console.error("Send error:", err.message);
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
        "Download failed. Instagram may have blocked this media. Check Render logs."
      );
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SPEED×999 running on port ${PORT}`);
});
