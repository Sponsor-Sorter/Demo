// Keep a short line behind a traveller without cutting across grid corners.
export function updateGridTrail(points, x, y, maxLength = 34) {
  const last = points.at(-1);
  if (!last || last.x !== x || last.y !== y) points.push({ x, y });
  let length = 0;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1], b = points[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (length + segment > maxLength) {
      const fraction = (maxLength - length) / segment;
      points.splice(0, i, { x: b.x + (a.x - b.x) * fraction, y: b.y + (a.y - b.y) * fraction });
      break;
    }
    length += segment;
  }
  return points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}
