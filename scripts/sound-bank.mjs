import { readdir } from 'node:fs/promises';

/** List sound bank entries as [clipKey, fileName, fileUrl] under project root. */
export async function listSoundBank(root, subpath, extensions) {
  const directory = new URL(subpath, root);
  try {
    const files = (await readdir(directory))
      .filter(file => extensions.some(ext => file.endsWith(ext)))
      .sort();
    return files.map(file => [file.replace(/\.[^.]+$/, ''), file, new URL(file, directory)]);
  } catch {
    return [];
  }
}
