"""Cut exactly two loud adjacent nonverbal syllables, with no stretching."""
from pathlib import Path
import subprocess,wave
root=Path(__file__).resolve().parents[1]
source=Path('E:/EWeChat Files/xwechat_files/wxid_aw869ecf2dj412_6d27/msg/file/2026-11/大肥鱼吃米饭.mp3')
dest=root/'assets/audio/whale/偷吃_喃喃两声_V23.wav'
# Zero-based decoded-audio times; two pulse centres ~4.45s / 4.60s,
# delimited by the valleys at 4.315, 4.525 and 4.770 seconds.
subprocess.run(['E:/剪映/JianyingPro/11.6.0.14552/ffmpeg.exe','-y','-hide_banner','-loglevel','error',
 '-i',str(source),'-vn','-af',
 'asetpts=PTS-STARTPTS,atrim=start=4.315:end=4.770,asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=0.443:d=0.012',
 '-map_metadata','-1','-ac','1','-ar','44100','-c:a','pcm_s16le',str(dest)],check=True)
with wave.open(str(dest)) as audio:
 print(f'Two syllables: {audio.getnframes()/audio.getframerate():.3f}s')
