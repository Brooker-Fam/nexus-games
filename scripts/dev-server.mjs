import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const spaFallbackRoutes = new Set(['/insight-wars']);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
]);

function send(res, status, body, contentType = 'text/plain; charset=utf-8'){
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

function safeFilePath(pathname){
  const normalized = normalize(decodeURIComponent(pathname)).replace(/^\.\.(?:[/\\]|$)/, '');
  const fullPath = resolve(join(root, normalized));
  return fullPath.startsWith(root) ? fullPath : null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  if(pathname.startsWith('/api/')){
    send(res, 404, JSON.stringify({ error: 'API routes require Vercel or production hosting.' }), 'application/json; charset=utf-8');
    return;
  }

  if(pathname === '/' || spaFallbackRoutes.has(pathname)){
    pathname = '/index.html';
  }

  const fullPath = safeFilePath(pathname);
  if(!fullPath || !existsSync(fullPath) || !statSync(fullPath).isFile()){
    send(res, 404, 'Not found');
    return;
  }

  const ext = extname(fullPath).toLowerCase();
  res.writeHead(200, { 'content-type': mimeTypes.get(ext) || 'application/octet-stream' });
  createReadStream(fullPath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Nexus Games dev server running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log('Open /insight-wars for the Insight Wars placeholder.');
});
