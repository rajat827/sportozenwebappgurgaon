import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const target = resolve(join(root, pathname === '/' ? 'index.html' : pathname.slice(1)));
    if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if (!(await stat(target)).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(await readFile(target));
  } catch { response.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Sportozen preview: http://127.0.0.1:${port}\n`));
