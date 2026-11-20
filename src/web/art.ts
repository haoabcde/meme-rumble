import arcade from '../../assets/ui/arcade.webp';
import whale from '../../assets/fighters/whale.webp';
import frog from '../../assets/fighters/frog-v2.webp';
import banana from '../../assets/fighters/banana.webp';
import gaga from '../../assets/fighters/gaga.webp';
import whaleMotion from '../../assets/fighters/whale-motion.webp';
import frogMotion from '../../assets/fighters/frog-motion.webp';
import bananaMotion from '../../assets/fighters/banana-motion.webp';
import gagaMotion from '../../assets/fighters/gaga-motion.webp';
import dorm from '../../assets/arenas/dorm-bg.webp';
import court from '../../assets/arenas/court-bg.webp';
import harbor from '../../assets/arenas/harbor-quay.webp';
import dockProps from '../../assets/arenas/harbor-props.webp';
import gantry from '../../assets/arenas/harbor-gantry.webp';
import station from '../../assets/arenas/station-bg.webp';
import dormKit from '../../assets/arenas/dorm-kit.webp';
import courtKit from '../../assets/arenas/court-kit.webp';
import stationKit from '../../assets/arenas/station-kit.webp';
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
export const motionArt = loadImages({ whale: whaleMotion, frog: frogMotion, banana: bananaMotion, gaga: gagaMotion });
export const backgrounds = loadImages(arenaArt);
export const { dockProps: harborProps, gantry: harborGantry } = loadImages({ dockProps, gantry });
export const stageKits = loadImages({ dorm: dormKit, court: courtKit, station: stationKit });
