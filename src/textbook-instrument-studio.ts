import { THREE as T } from './reference/engine.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** The mechanical reference uses RoomEnvironment for broad reflected light.
 * Keep that reflection on instruments only: the printed book and desk retain
 * their own window, paper shaders and existing illumination. One target belongs
 * to one book, and survives lesson changes without another PMREM allocation. */
export function createInstrumentStudio(renderer: any) {
  const room = new RoomEnvironment();
  const generator = new T.PMREMGenerator(renderer);
  let target: any;
  try { target = generator.fromScene(room, .04, .1, 100); }
  finally { room.dispose(); generator.dispose(); }
  target.texture.name = 'mechanical-reference-room-reflection';
  return { texture: target.texture, dispose: () => target.dispose() };
}
