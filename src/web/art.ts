import arcade from '../../assets/ui/arcade.webp';
import whale from '../../assets/fighters/whale.webp';
import frog from '../../assets/fighters/frog-v2.webp';
import banana from '../../assets/fighters/banana.webp';
import gaga from '../../assets/fighters/gaga.webp';
import dorm from '../../assets/arenas/dorm-wide.webp';
import court from '../../assets/arenas/court-wide.webp';
import harbor from '../../assets/arenas/harbor-wide.webp';
import station from '../../assets/arenas/station-wide.webp';
import type { ArenaDefinition } from '../core/types.js';

export const arcadeArt = arcade;
export const fighterArt: Record<string, string> = { whale, frog, banana, gaga };
export const arenaArt: Record<ArenaDefinition['theme'], string> = { dorm, court, harbor, station };

function loadImages(sources: Record<string, string>) {
  return Object.fromEntries(Object.entries(sources).map(([id, src]) => {
    const image = new Image();
    image.src = src;
    return [id, image];
  }));
}

export const sprites = loadImages(fighterArt);
export const backgrounds = loadImages(arenaArt);
