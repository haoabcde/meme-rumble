"""Cut exactly two loud adjacent nonverbal syllables, with no stretching."""
import argparse
from pathlib import Path
import subprocess,wave
root=Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path, help='Supplied recording to trim')
parser.add_argument('--ffmpeg', default='ffmpeg')
args = parser.parse_args()
source = args.source
dest=root/'assets/audio/whale/偷吃_喃喃两声_V23.wav'
# Zero-based decoded-audio times; two pulse centres ~4.45s / 4.60s,
# delimited by the valleys at 4.315, 4.525 and 4.770 seconds.
subprocess.run([args.ffmpeg,'-y','-hide_banner','-loglevel','error',
 '-i',str(source),'-vn','-af',
 'asetpts=PTS-STARTPTS,atrim=start=4.315:end=4.770,asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=0.443:d=0.012',
 '-map_metadata','-1','-ac','1','-ar','44100','-c:a','pcm_s16le',str(dest)],check=True)
with wave.open(str(dest)) as audio:
 print(f'Two syllables: {audio.getnframes()/audio.getframerate():.3f}s')
