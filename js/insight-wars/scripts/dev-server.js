import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function safePath(urlPath){
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  if(decoded === '/' || decoded === '/insight-wars') return join(repoRoot, 'index.html');
  const candidate = normalize(join(repoRoot, decoded));
  if(!candidate.startsWith(repoRoot)) return null;
  return candidate;
}

const server = createServer(async (req, res) => {
  try{
    const filePath = safePath(req.url || '/');
    if(!filePath || !existsSync(filePath) || !(await stat(filePath)).isFile()){
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  }catch(error){
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Dev server error: ${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`Insight Wars dev server listening on http://127.0.0.1:${port}/insight-wars`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
