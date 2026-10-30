import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [inputPath = "/tmp/inegi-mgee.geojson", outputPath = "src/features/generative-ui/geography/mexico-states.paths.json"] = process.argv.slice(2);
const source = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const width = 960;
const height = 600;
const padding = 20;

const coordinatePairs = source.features.flatMap((feature) => {
  const coordinates = feature.geometry?.coordinates ?? [];
  const polygons = feature.geometry?.type === "Polygon" ? [coordinates] : coordinates;
  return polygons.flatMap((polygon) => polygon.flat());
});
const bounds = coordinatePairs.reduce((current, [longitude, latitude]) => ({
  minLongitude: Math.min(current.minLongitude, longitude),
  maxLongitude: Math.max(current.maxLongitude, longitude),
  minLatitude: Math.min(current.minLatitude, latitude),
  maxLatitude: Math.max(current.maxLatitude, latitude),
}), {
  minLongitude: Number.POSITIVE_INFINITY,
  maxLongitude: Number.NEGATIVE_INFINITY,
  minLatitude: Number.POSITIVE_INFINITY,
  maxLatitude: Number.NEGATIVE_INFINITY,
});

const project = ([longitude, latitude]) => {
  const longitudeRatio = (longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude);
  const latitudeRatio = (bounds.maxLatitude - latitude) / (bounds.maxLatitude - bounds.minLatitude);
  return [
    padding + longitudeRatio * (width - padding * 2),
    padding + latitudeRatio * (height - padding * 2),
  ];
};

function perpendicularDistance(point, start, end) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const denominator = Math.hypot(x2 - x1, y2 - y1);
  if (denominator === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / denominator;
}

function simplify(points, tolerance = 0.55) {
  if (points.length <= 3) return points;
  let index = 0;
  let maxDistance = 0;
  for (let current = 1; current < points.length - 1; current += 1) {
    const distance = perpendicularDistance(points[current], points[0], points.at(-1));
    if (distance > maxDistance) {
      index = current;
      maxDistance = distance;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

function toPath(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon).map((ring) => {
    const projected = simplify(ring.map(project));
    return projected.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";
  }).join("");
}

const states = source.features.map((feature) => ({
  code: feature.properties.cve_ent,
  name: feature.properties.nomgeo,
  abbreviation: feature.properties.nom_abrev,
  path: toPath(feature.geometry),
})).sort((a, b) => a.code.localeCompare(b.code));

if (states.length !== 32 || new Set(states.map((state) => state.code)).size !== 32) {
  throw new Error("La geometría debe contener exactamente las 32 entidades federativas.");
}

const asset = {
  source: source.metadatos?.Fuente_informacion_vectorial ?? "INEGI. Marco Geoestadístico",
  sourceUrl: "https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgee/",
  generatedAt: "2026-10-17",
  viewBox: `0 0 ${width} ${height}`,
  states,
};

const absoluteOutput = resolve(outputPath);
await mkdir(dirname(absoluteOutput), { recursive: true });
await writeFile(absoluteOutput, `${JSON.stringify(asset)}\n`);
console.log(`Mapa generado: ${states.length} entidades, ${JSON.stringify(asset).length} bytes.`);
