import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fighterAudioMimeType, fighterAudioPrefix } from '../dist/content/fighter-kit.js';

const MAX_CLIP_BYTES = 8 * 1024 ** 2;
const MAX_AUDIO_BYTES = 32 * 1024 ** 2;

function wavHeader(bytes) {
  if (bytes.length < 44 || bytes.toString('latin1', 0, 4) !== 'RIFF' ||
      bytes.toString('latin1', 8, 12) !== 'WAVE') return false;
  const end = bytes.readUInt32LE(4) + 8;
  if (end > bytes.length) return false;
  let format = false;
  for (let offset = 12; offset + 8 <= end;) {
    const name = bytes.toString('latin1', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + length > end) return false;
    if (name === 'fmt ') {
      format = length >= 16 && bytes.readUInt16LE(data) > 0 &&
        bytes.readUInt16LE(data + 2) > 0 && bytes.readUInt32LE(data + 4) > 0 && bytes.readUInt16LE(data + 12) > 0;
    }
    if (name === 'data') return format && length > 0;
    offset = data + length + (length % 2);
  }
  return false;
}

const MPEG1_RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_RATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

function mp3Header(bytes) {
  let frame = 0;
  if (bytes.toString('latin1', 0, 3) === 'ID3') {
    if (bytes.length < 10 || ![2, 3, 4].includes(bytes[3]) || bytes.subarray(6, 10).some(n => n > 127)) return false;
    const tagSize = bytes.subarray(6, 10).reduce((size, byte) => size * 128 + byte, 0);
    const footerSize = bytes[3] === 4 && (bytes[5] & 0x10) ? 10 : 0;
    frame = 10 + tagSize + footerSize;
  }
  if (frame + 4 > bytes.length || bytes[frame] !== 0xff || (bytes[frame + 1] & 0xe6) !== 0xe2) return false;
  const version = (bytes[frame + 1] >> 3) & 3;
  const bitrateIndex = bytes[frame + 2] >> 4;
  const sampleIndex = (bytes[frame + 2] >> 2) & 3;
  if (version === 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return false;
  const bitrates = version === 3 ? MPEG1_RATES : MPEG2_RATES;
  const sampleRate = [44100, 48000, 32000][sampleIndex] / [4, 0, 2, 1][version];
  const bitrate = bitrates[bitrateIndex] * 1000;
  const padding = (bytes[frame + 2] >> 1) & 1;
  const length = Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + padding;
  return frame + length <= bytes.length;
}

function oggHeader(bytes) {
  if (bytes.length < 28 || bytes.toString('latin1', 0, 4) !== 'OggS' || bytes[4] !== 0 || !(bytes[5] & 2)) return false;
  const start = 27 + bytes[26];
  if (start >= bytes.length) return false;
  let length = 0;
  for (let index = 27; index < start; index++) {
    const segmentSize = bytes[index];
    length += segmentSize;
    if (segmentSize === 255) continue;
    if (start + length > bytes.length) return false;
    return (length >= 19 && bytes.toString('latin1', start, start + 8) === 'OpusHead' && bytes[start + 9] > 0) ||
      (length >= 30 && bytes[start] === 1 && bytes.toString('latin1', start + 1, start + 7) === 'vorbis' && bytes[start + 11] > 0);
  }
  return false;
}

function ebmlInteger(bytes, offset, end, maxLength, stripMarker) {
  if (offset >= end || bytes[offset] === 0) return undefined;
  let marker = 0x80;
  let length = 1;
  while (!(bytes[offset] & marker)) {
    marker >>= 1;
    length++;
  }
  if (length > maxLength || offset + length > end) return undefined;
  let value = stripMarker ? bytes[offset] - marker : bytes[offset];
  for (let index = 1; index < length; index++) value = value * 256 + bytes[offset + index];
  return { value, next: offset + length };
}

function webmHeader(bytes) {
  if (bytes.length < 12 || bytes.readUInt32BE(0) !== 0x1a45dfa3) return false;
  const header = ebmlInteger(bytes, 4, bytes.length, 8, true);
  if (!header) return false;
  const end = header.next + header.value;
  if (end + 5 > bytes.length || bytes.readUInt32BE(end) !== 0x18538067) return false;
  for (let offset = header.next; offset < end;) {
    const id = ebmlInteger(bytes, offset, end, 4, false);
    if (!id) return false;
    const size = ebmlInteger(bytes, id.next, end, 8, true);
    if (!size || size.next + size.value > end) return false;
    if (id.value === 0x4282) return size.value === 4 && bytes.toString('latin1', size.next, size.next + 4) === 'webm';
    offset = size.next + size.value;
  }
  return false;
}

const validateHeader = {
  'audio/wav': wavHeader, 'audio/mpeg': mp3Header, 'audio/ogg': oggHeader, 'audio/webm': webmHeader
};

async function resolveAudioRoot(projectDirectory) {
  const directory = resolve(await realpath(projectDirectory), fighterAudioPrefix);
  if (await realpath(directory) !== directory) throw Error('assets/audio/ 路径不能重定向到其他目录');
  return directory;
}

async function audioFile(directory, src) {
  const path = await realpath(resolve(directory, src.slice(fighterAudioPrefix.length)));
  const local = relative(directory, path);
  if (!local || isAbsolute(local) || local === '..' || local.startsWith('..' + sep)) {
    throw Error('素材解析后须位于 assets/audio/ 内');
  }
  return open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
}

export async function embedFighterAudio(roster, projectDirectory) {
  const clips = new Map();
  let directory;
  let totalBytes = 0;
  for (const { fighter, audio } of roster) {
    for (const [id, { src }] of Object.entries(audio ?? {})) {
      if (clips.has(src)) continue;
      try {
        const mime = fighterAudioMimeType(src);
        if (!mime) throw Error('须使用 assets/audio/ 内的 WAV、MP3、Ogg 或 WebM 路径');
        directory ??= await resolveAudioRoot(projectDirectory);
        const file = await audioFile(directory, src);
        try {
          const stat = await file.stat();
          const size = stat.size;
          if (!stat.isFile() || size === 0) throw Error('素材须为非空普通文件');
          if (size > MAX_CLIP_BYTES) throw Error('单个音频文件超过 8 MiB');
          if (totalBytes + size > MAX_AUDIO_BYTES) throw Error('单页内嵌音频总量超过 32 MiB');
          const bytes = await file.readFile();
          if (bytes.length !== size) throw Error('读取时素材大小发生变化，请重新构建');
          if (!validateHeader[mime](bytes)) throw Error('文件头无效或与扩展名不符');
          clips.set(src, 'data:' + mime + ';base64,' + bytes.toString('base64'));
          totalBytes += size;
        } finally {
          await file.close();
        }
      } catch (error) {
        throw Error(fighter.id + ' / audio.' + id + ' / ' + src + '：' + error.message, { cause: error });
      }
    }
  }
  return Object.fromEntries(clips);
}
