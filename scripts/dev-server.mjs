/**
 * Dev server tĩnh — không phụ thuộc gói ngoài.
 * Dùng cho `npm run dev`. Dự án là HTML/CSS/JS thuần, không cần build.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  // Chặn path traversal: mọi đường dẫn phải nằm trong ROOT.
  const target = normalize(join(ROOT, urlPath === "/" ? "/index.html" : urlPath));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end("403 Forbidden");
    return;
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
    console.log(`200 ${urlPath}`);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
    console.log(`404 ${urlPath}`);
  }
}).listen(PORT, () => {
  console.log(`Dev server dang chay: http://localhost:${PORT}`);
  console.log("Nhan Ctrl+C de dung.");
});
