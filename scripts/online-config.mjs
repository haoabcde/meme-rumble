import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const onlineHashInputs = ['src/core/', 'src/content/', 'src/web/online-room.ts', 'scripts/serve-online.mjs'];

/** Computes the protocol compatibility hash and optional WebSocket endpoint baked into web builds. */
export async function loadOnlineConfig(root) {
  const hash = createHash('sha256');
  for (const folder of onlineHashInputs) {
    const paths = folder.endsWith('/')
      ? (await readdir(new URL(folder, root), { recursive: true }))
        .filter(name => /\.[cm]?tsx?$/.test(name) || name.endsWith('.mjs')).sort().map(name => folder + name)
      : [folder];
    for (const path of paths) hash.update(path).update(await readFile(new URL(path, root)));
  }
  const onlineBuild = hash.digest('hex').slice(0, 20);
  const onlineUrl = process.env.ONLINE_SERVICE_URL?.trim() ?? '';
  if (onlineUrl && !/^wss:\/\//.test(onlineUrl)) throw Error('ONLINE_SERVICE_URL must be a wss:// address');
  return { onlineBuild, onlineUrl };
}
