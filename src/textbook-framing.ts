/** Fit all supplied corners inside the usable screen, including perspective
 * depth. Coordinates use camera right/up/towards-camera axes about the model.
 * This changes the observation camera only, never the lesson state. */
export function fitModelViewport(points: readonly (readonly [number, number, number])[], width: number,
  height: number, fov: number, topInset: number, bottomInset: number, leftInset = 0) {
  const tan = Math.tan(fov * Math.PI / 360), aspect = width / height;
  const top = 1 - 2 * Math.min(height * .38, Math.max(74, topInset)) / height;
  const bottom = -1 + 2 * Math.min(height * .42, Math.max(88, bottomInset)) / height;
  const centre = (top + bottom) / 2;
  const horizontal = Math.max(.5, 1 - 2 * (width < 900 ? 30 : 110) / width);
  const left = Math.max(-horizontal, 2 * leftInset / width - 1);
  const centreX = (horizontal + left) / 2;
  const halfWidth = (horizontal - left) / 2;
  let distance = 35;
  for (const [x, y, depth] of points) {
    distance = Math.max(distance, (x / (tan * aspect) + horizontal * depth) / halfWidth,
      (-x / (tan * aspect) - left * depth) / halfWidth,
      (y / tan + top * depth) / (top - centre),
      (-y / tan - bottom * depth) / (centre - bottom));
  }
  return { distance: distance * 1.035, shift: centre * distance * 1.035 * tan,
    top, bottom, horizontal, shiftX: centreX * distance * 1.035 * tan * aspect };
}
/** Use all four corners: opposite corners can project onto the same scanline
 * on an oblique mounted inscription even though its text is clearly visible. */
export function measureProjectedLabel(corners: readonly (readonly [number, number])[], fontRatio: number) {
  const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
  const vertical = (Math.hypot(corners[3][0] - corners[0][0], corners[3][1] - corners[0][1])
    + Math.hypot(corners[2][0] - corners[1][0], corners[2][1] - corners[1][1])) / 2;
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys), fontPx: vertical * fontRatio };
}

