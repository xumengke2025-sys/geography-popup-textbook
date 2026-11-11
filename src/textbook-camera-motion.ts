export type CameraPoint = [number, number, number];
export interface CameraPose { position: CameraPoint; focus: CameraPoint }

export interface ObservationAngle { orbit: number; elevation: number }

/** A reader's small inspection arc, never a turntable. It stays on the
 * readable side of the page and starts without angular velocity. */
export function observationCameraArc(base: ObservationAngle, seconds: number): ObservationAngle {
  const t = Math.max(0, seconds), angle = t * Math.PI / 12;
  const entrance = revealCameraProgress(Math.min(1, t / 2));
  const width = Math.max(0, Math.min(.18, .8 - Math.abs(base.orbit)));
  return {
    orbit: base.orbit + Math.sin(angle) * width * entrance,
    elevation: base.elevation + (1 - Math.cos(angle)) * .5 * Math.min(.055, Math.max(0, 1.45 - base.elevation)) * entrance,
  };
}

/** A five-term ease keeps both the speed and acceleration calm at a reveal's
 * ends. It follows the model's actual lift, never the browser wall clock. */
export function revealCameraProgress(lift: number): number {
  const t = Math.max(0, Math.min(1, lift));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function blendCameraPose(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const t = revealCameraProgress(progress);
  const blend = (a: CameraPoint, b: CameraPoint): CameraPoint =>
    a.map((value, i) => value + (b[i] - value) * t) as CameraPoint;
  return { position: blend(from.position, to.position), focus: blend(from.focus, to.focus) };
}

/** Exact critically damped response. Focus and camera move together, keeping
 * their velocities when a reader changes their mind halfway through a move.
 * There is no frame-count dependent lerp or independent look-at animation. */
export class BookCameraMotion {
  private values: number[];
  private velocities = Array<number>(6).fill(0);
  constructor(pose: CameraPose) { this.values = [...pose.position, ...pose.focus]; }
  get pose(): CameraPose {
    return { position: this.values.slice(0, 3) as CameraPoint, focus: this.values.slice(3, 6) as CameraPoint };
  }
  snap(pose: CameraPose) {
    this.values = [...pose.position, ...pose.focus]; this.velocities.fill(0);
    return this.pose;
  }
  step(target: CameraPose, dt: number, immediate = false, frequency = 9): CameraPose {
    if (immediate) return this.snap(target);
    // A resumed tab must not complete a hidden camera journey in one frame.
    const seconds = Math.max(0, Math.min(.1, dt));
    if(seconds===0)return this.pose;
    const destination = [...target.position, ...target.focus];
    const decay = Math.exp(-frequency * seconds);
    for (let i = 0; i < 6; i++) {
      const error = this.values[i] - destination[i];
      const travel = (this.velocities[i] + frequency * error) * seconds;
      this.values[i] = destination[i] + (error + travel) * decay;
      this.velocities[i] = (this.velocities[i] - frequency * travel) * decay;
    }
    return this.pose;
  }
}
