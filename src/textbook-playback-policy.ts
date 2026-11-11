import type { Figure } from './textbook-catalog';

/** Playback follows a visible task; structure choices have no fictitious history. */
export function playbackPolicy(figure: Pick<Figure, 'effect' | 'playback'>, selection: number) {
  const effect = figure.effect;
  const staticView = ['spheres', 'soil-composition', 'density', 'geo-time', 'air-composition', 'habitable', 'warehouse', 'wind-forces'].includes(effect)
    || effect === 'vegetation' && ![2, 4, 5].includes(selection)
    || effect === 'quake' && selection === 0
    || effect === 'pressure' && selection === 1
    || effect === 'solar-activity' && selection === 0
    || effect === 'mars-base' && selection === 0;
  const observation = ['strata', 'terrain-observation', 'river-valley'].includes(effect);
  return { enabled: !staticView, autoplay: !staticView && !observation,
    once: observation || figure.playback === 'once',
    label: observation ? (effect === 'strata' ? '地层展开程度' : '观察位置') : '演示进度' };
}

/** Near/far remains a comparison at one instant; entering the warning from the
 * structural view starts the process. */
export function restartForSelection(figure: Pick<Figure, 'effect' | 'restartOnSelection'>, previous: number, next: number) {
  return previous !== next && (figure.effect === 'quake' ? previous === 0 && next > 0 : !!figure.restartOnSelection);
}
