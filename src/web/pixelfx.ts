import whirlpool from '../../assets/fx/pixelfx/whirlpool.webp';
import waveCrash from '../../assets/fx/pixelfx/wave-crash.webp';
import splash from '../../assets/fx/pixelfx/splash.webp';
import hitSpark from '../../assets/fx/pixelfx/hit-spark.webp';
import heavyLanding from '../../assets/fx/pixelfx/heavy-landing.webp';

function load(src: string) {
  const image = new Image();
  image.src = src;
  return image;
}

// Frame geometry from Pixelfx's exporter. The embedded sheets retain selected frames from each effect.
const atlases = {
  whirlpool: { image: load(whirlpool), w: 128, h: 84, x: 64, y: 42, columns: 8, count: 45 },
  waveCrash: { image: load(waveCrash), w: 224, h: 104, x: 112, y: 86, columns: 7, count: 51 },
  splash: { image: load(splash), w: 176, h: 100, x: 88, y: 78, columns: 7, count: 20 },
  hitSpark: { image: load(hitSpark), w: 136, h: 80, x: 44, y: 44, columns: 7, count: 15 },
  heavyLanding: { image: load(heavyLanding), w: 176, h: 80, x: 88, y: 60, columns: 7, count: 26 }
};

export function drawPixelEffect(ctx: CanvasRenderingContext2D, effect: keyof typeof atlases,
  frame: number, x: number, y: number, scaleX: number, scaleY = scaleX, smooth = false) {
  const { image, w, h, x: pivotX, y: pivotY, columns, count } = atlases[effect];
  if (!image.naturalWidth) return;
  const index = Math.max(0, Math.min(count - 1, Math.floor(frame)));
  ctx.save();
  // Enlarged effects blend instead of showing magnified pixels next to the painted fighters.
  ctx.imageSmoothingEnabled = smooth;
  ctx.translate(x, y);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(image, index % columns * w, Math.floor(index / columns) * h, w, h, -pivotX, -pivotY, w, h);
  ctx.restore();
}
