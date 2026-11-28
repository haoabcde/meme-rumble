import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createSiteHandler } from './static-site.mjs';

const port = Number(process.env.PORT ?? 4183);
const host = process.env.HOST ?? '127.0.0.1';
const siteDir = fileURLToPath(new URL('../site', import.meta.url));
const server = createServer(createSiteHandler(siteDir));

server.listen(port, host, () => console.log('Meme 乱斗静态网站  http://' + host + ':' + port + '/'));
