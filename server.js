/**
 * Photo Booth Server
 * - 提供前端静态页面与 webm 动画资源
 * - 接收截图并保存到 captures/
 * - 生成指向局域网下载链接的 QR 码
 * - 提供手机端扫码后的照片查看/下载页
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CAPTURES_DIR = path.join(ROOT, 'captures');

for (const d of [CAPTURES_DIR, path.join(ASSETS_DIR, 'idle'), path.join(ASSETS_DIR, 'countdown')]) {
  fs.mkdirSync(d, { recursive: true });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function lanIp() {
  const nets = os.networkInterfaces();
  const preferred = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) preferred.push(net.address);
    }
  }
  // 优先返回常见局域网网段
  return preferred.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) || preferred[0] || '127.0.0.1';
}

function listWebm(sub) {
  try {
    return fs.readdirSync(path.join(ASSETS_DIR, sub))
      .filter(f => f.toLowerCase().endsWith('.webm'))
      .sort()
      .map(f => `/assets/${sub}/${encodeURIComponent(f)}`);
  } catch {
    return [];
  }
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// 防路径穿越
function safeJoin(base, urlPath) {
  const p = path.normalize(path.join(base, decodeURIComponent(urlPath)));
  if (!p.startsWith(base)) return null;
  return p;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function photoPage(id) {
  const safeId = escapeHtml(id);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Photo</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #ffffff;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /* 上半屏：欢迎语 */
  .hero {
    flex: 1 1 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #ffffff;
  }
  .hero h1 {
    color: #0b3d91;
    font-size: clamp(26px, 6vw, 52px);
    font-weight: 800;
    text-align: center;
    letter-spacing: .02em;
  }
  /* 下半屏：天蓝色内容区 */
  .content {
    flex: 1 1 50vh;
    background: #7ec8f5;
    border-radius: 32px 32px 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 24px 40px;
  }
  .caption {
    color: #0b3d91;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: .08em;
    margin-bottom: 16px;
  }
  .content img {
    max-width: 100%;
    max-height: 46vh;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(11, 61, 145, .25);
    background: #fff;
  }
  a.btn {
    display: inline-block;
    margin-top: 22px;
    padding: 14px 36px;
    background: #0b3d91;
    color: #fff;
    text-decoration: none;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 700;
    box-shadow: 0 6px 18px rgba(11, 61, 145, .35);
  }
  a.btn:active { background: #082c6a; }
</style>
</head>
<body>
  <section class="hero">
    <h1>Welcome!</h1>
  </section>
  <section class="content">
    <div class="caption">📸 Your Photo Booth Shot</div>
    <img src="/photo/${safeId}/file" alt="photo">
    <a class="btn" href="/photo/${safeId}/file?download=1">⬇ Save to Phone</a>
  </section>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const pathname = u.pathname;

  // API：前端配置（动画清单等）
  if (pathname === '/api/config') {
    return sendJson(res, 200, {
      idle: listWebm('idle'),
      countdown: listWebm('countdown'),
    });
  }

  // API：保存截图，返回 QR 码
  if (pathname === '/api/capture' && req.method === 'POST') {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 30 * 1024 * 1024) req.destroy(); // 30MB 上限
      else body += chunk;
    });
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body || '{}');
        const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(image || '');
        if (!m) return sendJson(res, 400, { error: 'bad image' });
        const ext = m[1] === 'jpeg' ? '.jpg' : '.png';
        const buf = Buffer.from(m[2], 'base64');
        const id = new Date().toISOString().replace(/[:.]/g, '-');
        const file = path.join(CAPTURES_DIR, id + ext);
        fs.writeFileSync(file, buf);
        const url = `http://${lanIp()}:${PORT}/photo/${encodeURIComponent(id + ext)}`;
        const qr = await QRCode.toDataURL(url, { width: 512, margin: 1 });
        console.log(`[capture] saved ${file}`);
        sendJson(res, 200, { id: id + ext, url, qr });
      } catch (e) {
        console.error(e);
        sendJson(res, 500, { error: 'server error' });
      }
    });
    return;
  }

  // 手机端照片页 / 照片文件
  const photoMatch = /^\/photo\/([^/]+)(\/file)?$/.exec(pathname);
  if (photoMatch) {
    const id = photoMatch[1];
    const isFile = !!photoMatch[2];
    const file = safeJoin(CAPTURES_DIR, id);
    if (!file || !fs.existsSync(file)) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
    if (!isFile) return send(res, 200, photoPage(id), { 'Content-Type': 'text/html; charset=utf-8' });
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'image/png' };
    if (u.searchParams.get('download') === '1') {
      headers['Content-Disposition'] = `attachment; filename="photobooth-${id}"`;
    }
    res.writeHead(200, headers);
    return fs.createReadStream(file).pipe(res);
  }

  // 动画资源
  if (pathname.startsWith('/assets/')) {
    const file = safeJoin(ASSETS_DIR, pathname.slice('/assets/'.length));
    if (!file) return send(res, 403, 'Forbidden');
    return serveFile(res, file);
  }

  // 前端静态文件
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }
  const file = safeJoin(PUBLIC_DIR, pathname);
  if (!file) return send(res, 403, 'Forbidden');
  return serveFile(res, file);
});

server.listen(PORT, () => {
  console.log(`Photo Booth running:`);
  console.log(`  本机:   http://localhost:${PORT}`);
  console.log(`  局域网: http://${lanIp()}:${PORT}  (手机扫码下载走这个地址)`);
});
