import arcade from '../../assets/ui/arcade.webp';
import comic from '../../assets/ui/comic-paper.webp';
import { roster } from '../content/roster.js';
import type { FighterArt } from '../content/fighter-kit.js';
import dorm from '../../assets/arenas/dorm-bg.webp';
import court from '../../assets/arenas/court-bg.webp';
import harbor from '../../assets/arenas/harbor-quay.webp';
import dockProps from '../../assets/arenas/harbor-props.webp';
import gantry from '../../assets/arenas/harbor-gantry.webp';
import station from '../../assets/arenas/station-bg.webp';
import dormKit from '../../assets/arenas/dorm-kit.webp';
import courtKit from '../../assets/arenas/court-kit.webp';
import stationKit from '../../assets/arenas/station-kit.webp';
import broadcast from '../../assets/arenas/broadcast-bg.webp';
import broadcastKit from '../../assets/arenas/broadcast-kit.webp';
import type { ArenaDefinition } from '../core/types.js';

export const arcadeArt = arcade;
export const comicArt = comic;
// The offline build embeds only the files named by the four character packages.
declare const __FIGHTER_IMAGES__: Record<string, string>;
function fighterSources(kind: keyof FighterArt): Record<string, string> {
  return Object.fromEntries(roster.map(({ fighter, art }) => [fighter.id, __FIGHTER_IMAGES__[art[kind]]]));
}
export const fighterArt = fighterSources('portrait');
export const arenaArt: Record<ArenaDefinition['theme'], string> = { dorm, court, harbor, station, broadcast };

function loadImages(sources: Record<string, string>) {
  return Object.fromEntries(Object.entries(sources).map(([id, src]) => {
    const image = new Image();
    image.src = src;
    return [id, image];
  }));
}

export const sprites = loadImages(fighterArt);
export const motionArt = loadImages(fighterSources('motion'));
export const backgrounds = loadImages(arenaArt);
export const { dockProps: harborProps, gantry: harborGantry } = loadImages({ dockProps, gantry });
export const stageKits = loadImages({ dorm: dormKit, court: courtKit, station: stationKit, broadcast: broadcastKit });
