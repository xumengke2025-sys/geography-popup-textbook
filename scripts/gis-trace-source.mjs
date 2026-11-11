import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Read-only pixel inspection of the textbook reference, not an asset generator.
const reference = 'public/textbook/page-122.webp';
const uri = `data:image/webp;base64,${(await fs.readFile(reference)).toString('base64')}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ uri, reference }) => {
    const image = new Image(); image.src = uri; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const [x0, y0, x1, y1] = [250, 965, 800, 1155], width = x1 - x0, height = y1 - y0;
    const mask = new Uint8Array(width * height), seen = new Uint8Array(mask.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = ((y + y0) * canvas.width + x + x0) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r < 145 && g > 85 && g < 180 && b > 135 && b > g * 1.10 && b - r > 45) mask[y * width + x] = 1;
    }
    const components = [];
    for (let index = 0; index < mask.length; index++) if (mask[index] && !seen[index]) {
      const pending = [index], pixels = []; seen[index] = 1;
      while (pending.length) {
        const q = pending.pop(), x = q % width, y = Math.floor(q / width); pixels.push([x, y]);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (mask[n] && !seen[n]) { seen[n] = 1; pending.push(n); }
        }
      }
      if (pixels.length >= 10) {
        const xs = pixels.map(p => p[0]), ys = pixels.map(p => p[1]);
        components.push({ x: x0 + (Math.min(...xs) + Math.max(...xs)) / 2, y: y0 + (Math.min(...ys) + Math.max(...ys)) / 2,
          pixels: pixels.length, bounds: [x0 + Math.min(...xs), y0 + Math.min(...ys), x0 + Math.max(...xs), y0 + Math.max(...ys)] });
      }
    }
    const regionMasks = [
      (r, g, b) => r > 215 && g > 130 && g < 208 && b > 150 && b < 225 && r - g > 35,
      (r, g, b) => r > 100 && r < 190 && g > 180 && b > 200 && b - r > 25,
      (r, g, b) => r > 160 && r < 230 && g > 195 && b > 100 && b < 185 && g - b > 35,
    ];
    const simplify = (points, epsilon = 1.4) => {
      if (points.length <= 2) return points;
      const [a, z] = [points[0], points.at(-1)], dx = z[0] - a[0], dy = z[1] - a[1], l = dx * dx + dy * dy;
      let distance = 0, at = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const q = points[i], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (l || 1)));
        const d = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
        if (d > distance) { distance = d; at = i; }
      }
      return distance > epsilon ? [...simplify(points.slice(0, at + 1), epsilon).slice(0, -1), ...simplify(points.slice(at), epsilon)] : [a, z];
    };
    const regions = regionMasks.map((accept, i) => {
      const rows = [];
      for (let y = 1250; y <= 1428; y++) {
        const xs = [];
        for (let x = 250; x <= 795; x++) {
          const k = (y * canvas.width + x) * 4;
          if (accept(data[k], data[k + 1], data[k + 2])) xs.push(x);
        }
        if (xs.length > 3) rows.push({ y, left: Math.min(...xs), right: Math.max(...xs) });
      }
      const left = simplify(rows.map(r => [r.left, r.y])), right = simplify(rows.map(r => [r.right, r.y]).reverse());
      return { id: i + 1, pixelPolygon: [...left, ...right] };
    });
    // Each printed layer is the same map in a perspective quadrilateral.
    const toUnit = ([x, y], top, bottom) => {
      const v = (y - top) / (bottom - top), left = 419.5 + (254 - 419.5) * v, right = 789.5 + (634.5 - 789.5) * v;
      return [Number(((x - left) / (right - left)).toFixed(5)), Number(v.toFixed(5))];
    };
    const stations = components.sort((a, b) => a.y - b.y || a.x - b.x).map(p => ({ ...p, uv: toUnit([p.x, p.y], 970, 1147) }));
    return { reference, dimensions: [canvas.width, canvas.height], stations,
      regions: regions.map(r => ({ ...r, uv: r.pixelPolygon.map(p => toUnit(p, 1251, 1427)) })) };
  }, { uri, reference });
  await fs.writeFile('output/gis-source-trace.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, count: result.stations.length }));
} finally { await browser.close(); }
