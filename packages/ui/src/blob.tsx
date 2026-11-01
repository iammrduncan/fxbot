import { useEffect, useMemo, useRef } from "react";
import { colors, shapes, type Color, type Shape } from "@fxbot/sdk/client";

// The shapes, drawn once in a 100×100 box. Each starts as an exact outline, corners and all. Its points are spaced
// evenly, its corners rounded by averaging each point with its neighbours, and the result is turned, stretched, and
// fitted to the same box, then drawn as one smooth closed curve (Catmull-Rom segments as cubic Béziers).
type Point = [number, number];
const f = (n: number) => n.toFixed(1);
const ring = (count: number, point: (t: number) => Point) => Array.from({ length: count }, (_, i) => point((i / count) * 2 * Math.PI));
const polar = (radius: (t: number) => number) => ring(360, (t): Point => [radius(t) * Math.cos(t), radius(t) * Math.sin(t)]);
// A regular polygon with a corner at the top.
const corners = (sides: number) => ring(sides, (t): Point => [Math.sin(t), -Math.cos(t)]);
const lobes = (count: number, base: number, power = 1) => (t: number) => base + (1 - base) * ((1 + Math.cos(count * t)) / 2) ** power;

// `count` points spaced evenly along a closed outline.
function even(points: Point[], count: number): Point[] {
  const n = points.length;
  const along = [0];
  for (let i = 1; i <= n; i++) along.push(along[i - 1] + Math.hypot(points[i % n][0] - points[i - 1][0], points[i % n][1] - points[i - 1][1]));
  const out: Point[] = [];
  for (let k = 0, j = 0; k < count; k++) {
    const at = (k / count) * along[n];
    while (along[j + 1] < at) j++;
    const [a, b] = [points[j], points[(j + 1) % n]];
    const t = (at - along[j]) / (along[j + 1] - along[j] || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// Each pass moves every point toward its neighbours, which rounds corners and leaves straight edges straight.
function soften(points: Point[], passes: number) {
  const at = (list: Point[], i: number) => list[(i + list.length) % list.length];
  for (let pass = 0; pass < passes; pass++)
    points = points.map(([x, y], i): Point => [(at(points, i - 1)[0] + 2 * x + at(points, i + 1)[0]) / 4, (at(points, i - 1)[1] + 2 * y + at(points, i + 1)[1]) / 4]);
  return points;
}

// Stretched, turned by `turn` degrees, then scaled and centred so the larger side spans 82 of the 100.
function fit(points: Point[], turn: number, sx: number, sy: number) {
  const a = (turn * Math.PI) / 180;
  const moved = points.map(([x, y]): Point => [x * sx * Math.cos(a) - y * sy * Math.sin(a), x * sx * Math.sin(a) + y * sy * Math.cos(a)]);
  const [xs, ys] = [moved.map((p) => p[0]), moved.map((p) => p[1])];
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  const [width, height] = [Math.max(...xs) - left, Math.max(...ys) - top];
  const scale = 82 / Math.max(width, height);
  return moved.map(([x, y]): Point => [50 + (x - left - width / 2) * scale, 50 + (y - top - height / 2) * scale]);
}

function smooth(points: Point[]) {
  const at = (i: number) => points[(i + points.length) % points.length];
  let d = `M${f(at(0)[0])} ${f(at(0)[1])}`;
  for (let i = 0; i < points.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

// The middle of the area, where the eyes go, so they sit inside a triangle as well as a circle.
function centroid(points: Point[]): Point {
  let [area, x, y] = [0, 0, 0];
  points.forEach(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    [area, x, y] = [area + cross, x + (x0 + x1) * cross, y + (y0 + y1) * cross];
  });
  return [x / (3 * area), y / (3 * area)];
}

// The path, where its eyes go, and its top above them, where a pumpkin's stem grows. `lower` moves the eyes down,
// as below a heart's notch.
function blob(outline: Point[], { round = 0, turn = 0, sx = 1, sy = 1, lower = 0 } = {}) {
  const points = even(fit(soften(even(outline, 120), round), turn, sx, sy), 64);
  const [cx, cy] = centroid(points);
  const center: Point = [cx, cy + lower];
  const top = points.filter(([x, y]) => y < center[1] && Math.abs(x - center[0]) < 8).sort((a, b) => a[1] - b[1])[0] ?? [50, 9];
  return { d: smooth(points), center, top };
}

const drawn: Record<Shape, ReturnType<typeof blob>> = {
  circle: blob(polar(() => 1)),
  cloud: blob(polar((t) => 1 + 0.24 * Math.abs(Math.cos(2.5 * t))), { round: 2, turn: 18 }),
  squircle: blob(corners(4), { round: 70, turn: 57 }),
  star: blob(polar(lobes(4, 0.64, 1.2)), { round: 8, turn: 10 }),
  clover: blob(polar((t) => 0.68 + 0.32 * Math.abs(Math.cos(2 * t))), { round: 3, turn: 45 }),
  heart: blob(ring(240, (t): Point => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]), { round: 8, turn: -10, lower: 7 }),
  flower: blob(polar((t) => 1 + 0.13 * Math.cos(8 * t)), { round: 1 }),
  egg: blob(polar((t) => 1 + 0.15 * Math.sin(t)), { turn: -16, sy: 1.08 }),
  bean: blob([[-1.5, -1], [1.5, -1], [1.5, 1], [-1.5, 1]], { round: 160, turn: -8 }),
  triangle: blob(corners(3), { round: 90, turn: -6 }),
  diamond: blob(corners(4), { round: 60, turn: 12, sy: 1.18 }),
  sparkle: blob(polar(lobes(6, 0.64, 1.4)), { round: 3 }),
  hexagon: blob(corners(6), { round: 45, turn: 30 }),
  pumpkin: blob(polar((t) => 1 - 0.18 * Math.abs(Math.sin(t)) ** 12), { round: 2, sx: 1.3 }),
};

// The pointer's last position, for every blob that follows it: one listener for the page, and one update a frame.
const watchers = new Set<(x: number, y: number) => void>();
let pointer: Point | null = null;
let frame = 0;
function move(event: PointerEvent) {
  pointer = [event.clientX, event.clientY];
  frame ||= requestAnimationFrame(() => {
    frame = 0;
    for (const watch of watchers) watch(...pointer!);
  });
}
function watchPointer(watch: (x: number, y: number) => void) {
  if (!watchers.size) addEventListener("pointermove", move, { passive: true });
  watchers.add(watch);
  if (pointer) watch(...pointer);
  return () => {
    watchers.delete(watch);
    if (!watchers.size) removeEventListener("pointermove", move);
  };
}

const label = (name: string) => name[0].toUpperCase() + name.slice(1);

// A bot's look. With `follow`, its eyes follow the pointer and its body leans toward it. `busy` makes it hop and look
// around instead. A fixed `look` points the eyes, as in the shape picker. index.css holds the motion, which stops under
// reduced motion.
export function Blob({ shape, color, size = 40, follow = false, busy = false, look, className = "" }: { shape: Shape; color: Color; size?: number; follow?: boolean; busy?: boolean; look?: Point; className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const lean = useRef<SVGGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  // Blinks at their own times, not all at once.
  const blink = useMemo(() => ({ animationDelay: `${-Math.random() * 6}s` }), []);
  useEffect(() => {
    if (!follow || busy) return;
    const stop = watchPointer((x, y) => {
      const box = svg.current?.getBoundingClientRect();
      if (!box) return;
      const [dx, dy] = [x - (box.left + box.width / 2), y - (box.top + box.height / 2)];
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / (box.width * 1.5));
      eyes.current?.setAttribute("transform", `translate(${f((dx / distance) * 9 * reach)} ${f((dy / distance) * 7 * reach)})`);
      lean.current?.setAttribute("transform", `rotate(${f((dx / distance) * 6 * reach)} 50 60)`);
    });
    return () => {
      stop();
      eyes.current?.removeAttribute("transform");
      lean.current?.removeAttribute("transform");
    };
  }, [follow, busy]);

  const { d, center, top } = drawn[shape];
  const [x, y] = [top[0], top[1]];
  return (
    <svg ref={svg} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" data-shape={shape} data-busy={busy || undefined} className={`blob shrink-0 overflow-visible ${className}`}>
      <g className="blob-body">
        <g ref={lean}>
          <path className="blob-shape" d={d} fill={colors[color]} />
          {shape === "pumpkin" && <path d={`M${f(x - 1)} ${f(y + 4)} C${f(x - 2)} ${f(y - 3)} ${f(x + 1)} ${f(y - 8)} ${f(x + 7)} ${f(y - 9)}`} fill="none" stroke="#3f3a36" strokeWidth="4.5" strokeLinecap="round" />}
          <g transform={`translate(${f(center[0] - 50 + (look?.[0] ?? 0))} ${f(center[1] - 50 + (look?.[1] ?? 0))})`}>
            <g ref={eyes} className="blob-eyes">
              <g className="blob-look">
                <rect className="blob-eye" x="37" y="38" width="8" height="21" rx="4" fill="white" style={blink} />
                <rect className="blob-eye" x="55" y="38" width="8" height="21" rx="4" fill="white" style={blink} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

// The shape and color choices, each drawn in the bot's current look.
export function LookPicker({ shape, color, onShape, onColor }: { shape: Shape; color: Color; onShape: (shape: Shape) => void; onColor: (color: Color) => void }) {
  return (
    <div className="grid gap-6">
      <div role="group" aria-label="Shape" className="mx-auto flex max-w-[22rem] flex-wrap justify-center gap-x-3 gap-y-2">
        {shapes.map((s) => (
          <button key={s} type="button" aria-label={label(s)} aria-pressed={s === shape} onClick={() => onShape(s)} className={`rounded-full p-1.5 transition ${s === shape ? "ring-2 ring-foreground/20" : "hover:bg-muted"}`}>
            <Blob shape={s} color={color} size={44} look={[4, -4]} />
          </button>
        ))}
      </div>
      <div role="group" aria-label="Color" className="mx-auto flex max-w-[18rem] flex-wrap justify-center gap-3">
        {(Object.keys(colors) as Color[]).map((c) => (
          <button key={c} type="button" aria-label={label(c)} aria-pressed={c === color} onClick={() => onColor(c)} className={`size-9 rounded-full ring-offset-2 ring-offset-background transition ${c === color ? "ring-2 ring-foreground/25" : "hover:scale-110"}`} style={{ background: colors[c] }} />
        ))}
      </div>
    </div>
  );
}
