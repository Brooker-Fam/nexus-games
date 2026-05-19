import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createServer } from 'node:http';

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 3000);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(res, status, body){
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function staticPath(urlPath){
  const safePath = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^([/\\])+/, '');
  return resolve(join(root, safePath || 'index.html'));
}

createServer((req, res) => {
  if(req.url === '/api/session'){
    sendJson(res, 200, { user: null });
    return;
  }

  if(req.url?.startsWith('/api/')){
    sendJson(res, 501, { error: 'local_static_dev_server', message: 'API routes are not implemented by scripts/dev-server.js.' });
    return;
  }

  let filePath = staticPath(req.url || '/');
  if(!filePath.startsWith(root)){
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if(existsSync(filePath) && statSync(filePath).isDirectory()){
    filePath = join(filePath, 'index.html');
  }

  if(!existsSync(filePath)){
    filePath = join(root, 'index.html');
  }

  const type = types[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(filePath).pipe(res);
}).listen(port, '0.0.0.0', () => {
  console.log(`Nexus Games dev server running at http://localhost:${port}`);
});
