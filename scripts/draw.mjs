// Drawing code for the profile graphics. Used by scripts/build.mjs, which writes the files,
// and by api/views.js, which draws the view-count card live on each request.
// Each graphic is drawn twice, light and dark; text is drawn as outlines so it looks the
// same on every device.

import * as fonts from './font.mjs';
import { logos } from './icons.mjs';
import { profile } from './content.mjs';

export const LOGIN = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER || profile.user;

// ------------------------------------------------------------------ themes

const THEMES = {
  light: { ink: '#1f2328', muted: '#59636e', faint: '#d1d9e0', accent: '#6a4ee0', onAccent: '#ffffff', tint: '#1f2328', tintOpacity: 0.025 },
  dark: { ink: '#f0f6fc', muted: '#9198a1', faint: '#3d444d', accent: '#a48cf2', onAccent: '#0d1117', tint: '#f0f6fc', tintOpacity: 0.035 },
};

// ------------------------------------------------------------------ text as outlines

const n = (v) => String(Math.round(v * 100) / 100);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function measure(str, face, size, tracking = 0) {
  const font = fonts[face];
  let units = 0;
  const chars = [...str];
  chars.forEach((ch, i) => {
    const glyph = font.glyphs[ch] ?? font.glyphs['?'];
    units += glyph[0] + (font.kern[ch + (chars[i + 1] ?? '')] ?? 0);
  });
  return (units / font.upm) * size + tracking * size * Math.max(0, chars.length - 1);
}

// A canvas collects the glyphs it uses into <defs> so each outline is stored once per file.
function canvas(width, height, title) {
  const used = new Map();
  const body = [];

  function text(str, { face = 'regular', size, x, y, fill, anchor = 'start', tracking = 0, opacity }) {
    const font = fonts[face];
    const scale = size / font.upm;
    const total = measure(str, face, size, tracking);
    const start = anchor === 'end' ? x - total : anchor === 'middle' ? x - total / 2 : x;
    const chars = [...str];
    let cursor = 0;
    let uses = '';
    chars.forEach((ch, i) => {
      const key = font.glyphs[ch] ? ch : '?';
      const glyph = font.glyphs[key];
      if (glyph[1]) {
        const id = `${face[0]}${key.codePointAt(0).toString(36)}`;
        used.set(id, glyph[1]);
        uses += `<use href="#${id}" x="${Math.round(cursor)}"/>`;
      }
      cursor += glyph[0] + (font.kern[ch + (chars[i + 1] ?? '')] ?? 0) + (tracking * font.upm);
    });
    body.push(`<g fill="${fill}"${opacity ? ` opacity="${opacity}"` : ''} transform="translate(${n(start)} ${n(y)}) scale(${scale.toFixed(5)})">${uses}</g>`);
    return total;
  }

  const add = (markup) => body.push(markup);

  function render({ style = '', defs = '' } = {}) {
    const glyphs = [...used].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" role="img" aria-labelledby="t">
<title id="t">${esc(title)}</title>
${style ? `<style>${style}</style>\n` : ''}<defs>${glyphs}${defs}</defs>
${body.join('\n')}
</svg>
`;
  }

  return { text, add, render };
}

function wrap(str, face, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of str.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, face, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ------------------------------------------------------------------ banner

// A tilted torus wrapped in spiralling lines that roll through its hole.
//
// SVG has no 3D, but each cross-section of the tube is a ring of points turning in its own
// plane, and from the camera that plane is just a flat one, squashed and turned. So every
// cross-section is a small stack of groups: move to the ring's centre and turn to face along
// it, squash by how edge-on the ring is, and inside that one CSS rotation shared by every ring.
// Offsetting each ring a little from the last makes the points line up into spirals. Each ring
// is drawn clipped to the half whose surface faces the viewer (bright), and every second ring
// also to the half that faces away (dim), which gives the depth.
const PERIOD = 36;   // seconds for a point to travel once around the tube

function torus({ scale, tilt, roll, farOpacity, corners, twist, faceLines, minor }) {
  const RINGS = 360;
  const MAJOR = 1, MINOR = minor;
  // x right, y up, z toward the viewer: tip the axis toward the viewer, then lean it sideways
  const turn = ([x, y, z]) => {
    const y1 = y * Math.cos(tilt) - z * Math.sin(tilt), z1 = y * Math.sin(tilt) + z * Math.cos(tilt);
    return [x * Math.cos(roll) - y1 * Math.sin(roll), x * Math.sin(roll) + y1 * Math.cos(roll), z1];
  };
  const axis = turn([0, 1, 0]);
  let far = '', near = '';
  for (let i = 0; i < RINGS; i++) {
    const phi = (2 * Math.PI * i) / RINGS;
    const out = turn([Math.cos(phi), 0, Math.sin(phi)]);       // from the axis out to this ring's centre
    // In the ring's plane, `facing` points toward the viewer and `along` runs across the view,
    // so on screen `along` keeps its full length and `facing` is what gets foreshortened.
    const length = Math.hypot(out[2], axis[2]) || 1;
    const nx = out[2] / length, ny = axis[2] / length;
    const onScreen = (ex, ey) => [out[0] * ex + axis[0] * ey, -(out[1] * ex + axis[1] * ey)];
    const along = onScreen(ny, -nx), facing = onScreen(nx, ny);
    const heading = (Math.atan2(along[1], along[0]) * 180) / Math.PI;
    const squash = facing[1] * along[0] - facing[0] * along[1];   // signed: negative flips the ring over
    const frame = Math.atan2(-nx, ny);
    // The cross-section is a polygon that turns as it travels round the ring. Its corners are
    // drawn on every ring, so they join into solid edges; a few points along each side are
    // drawn on every third ring only, which leaves the faces as fainter dotted lines.
    const spots = [];
    for (let k = 0; k < corners; k++) {
      const from = (2 * Math.PI * k) / corners + twist * phi - frame;
      const to = from + (2 * Math.PI) / corners;
      const corner = [Math.cos(from), Math.sin(from)], next = [Math.cos(to), Math.sin(to)];
      spots.push(corner);
      if (i % 3 === 0) {
        for (let j = 1; j <= faceLines; j++) {
          const f = j / (faceLines + 1);
          spots.push([corner[0] + (next[0] - corner[0]) * f, corner[1] + (next[1] - corner[1]) * f]);
        }
      }
    }
    const angles = spots.map(([x, y]) => Math.atan2(y, x));
    const points = spots.map(([x, y]) => `M${(MINOR * scale * x).toFixed(1)} ${(MINOR * scale * y).toFixed(1)}h.01`);
    const place = `translate(${(MAJOR * scale * out[0]).toFixed(1)} ${(-MAJOR * scale * out[1]).toFixed(1)}) rotate(${heading.toFixed(2)})`;
    if (Math.abs(squash) >= 0.07) {
      const ring = (side) => `<g transform="${place}" clip-path="url(#${(side === 'near') === (squash >= 0) ? 'below' : 'above'})"><g transform="scale(1 ${squash.toFixed(4)})"><path class="roll" d="${points.join('')}"/></g></g>`;
      if (i % 2 === 0) far += ring('far');
      near += ring('near');
    } else {
      // Seen almost edge-on, a ring is a line: its two halves land on top of each other, so no
      // clip can tell them apart. Here each point dims itself for the half turn it spends on
      // the far side instead. (And the squash never reaches zero: a flat transform draws nothing.)
      const flat = (squash < 0 ? -1 : 1) * Math.max(Math.abs(squash), 0.03);
      const dim = i % 2 === 0 ? 'a' : 'b';
      const dots = points.map((d, k) => {
        const turnDone = (((angles[k] / (2 * Math.PI)) % 1) + 1) % 1;       // 0 to 0.5 is the near side
        return `<path class="side-${dim}" style="animation-delay:0s,${(-turnDone * PERIOD).toFixed(2)}s${turnDone < 0.5 ? '' : `;stroke-opacity:${dim === 'a' ? farOpacity : 0}`}" d="${d}"/>`;
      });
      near += `<g transform="${place}"><g transform="scale(1 ${flat.toFixed(4)})">${dots.join('')}</g></g>`;
    }
  }
  const reach = MINOR * scale + 4;
  return { far, near, clips: `<clipPath id="above"><rect x="${-reach}" y="${-reach}" width="${2 * reach}" height="${reach}"/></clipPath><clipPath id="below"><rect x="${-reach}" width="${2 * reach}" height="${reach}"/></clipPath>` };
}

// Breaks text into the fewest lines that fit, then evens out their lengths.
function wrapBalanced(str, face, size, maxWidth) {
  const lines = wrap(str, face, size, maxWidth);
  let best = lines;
  for (let width = maxWidth - 10; width > maxWidth / 2; width -= 10) {
    const attempt = wrap(str, face, size, width);
    if (attempt.length > lines.length) break;
    best = attempt;
  }
  return best;
}

export function banner(theme) {
  const t = THEMES[theme];
  const W = 846, H = 268;
  const c = canvas(W, H, `${profile.name}. ${profile.tagline}`);
  const farOpacity = theme === 'dark' ? 0.24 : 0.28;
  // `twist` is how many times the square cross-section turns per lap; at 1.25 its four corners
  // join into one edge that wraps the ring four times before closing.
  const rad = (deg) => (deg * Math.PI) / 180;
  const { far, near, clips } = torus({ scale: 92, tilt: rad(50), roll: rad(-22), corners: 4, twist: 1.25, faceLines: 2, minor: 0.48, farOpacity });

  c.add(`<g class="torus" transform="translate(708 ${H / 2})" fill="none" stroke="${t.accent}" stroke-width="1.8" stroke-linecap="round"><g opacity="${farOpacity}">${far}</g><g>${near}</g></g>`);
  const lines = wrapBalanced(profile.tagline, 'regular', 16.5, 530);
  const top = 134 - (lines.length - 1) * 12;       // keep the block centred as lines are added
  c.text(profile.name, { face: 'display', size: 68, x: 0, y: top, fill: t.ink, tracking: 0.004 });
  lines.forEach((line, i) => c.text(line, { face: 'regular', size: 16.5, x: 2, y: top + 37 + i * 25, fill: t.muted }));

  return c.render({
    // non-scaling-stroke keeps every point round however its ring is squashed
    style: `
  .torus path { vector-effect: non-scaling-stroke; }
  .roll { animation: roll ${PERIOD}s linear infinite; }
  .side-a { animation: roll ${PERIOD}s linear infinite, side-a ${PERIOD}s step-end infinite; }
  .side-b { animation: roll ${PERIOD}s linear infinite, side-b ${PERIOD}s step-end infinite; }
  .torus { animation: arrive 1.4s ease-out backwards; }
  @keyframes roll { to { transform: rotate(360deg); } }
  @keyframes side-a { 0% { stroke-opacity: 1; } 50% { stroke-opacity: ${farOpacity}; } }
  @keyframes side-b { 0% { stroke-opacity: 1; } 50% { stroke-opacity: 0; } }
  @keyframes arrive { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .roll, .side-a, .side-b, .torus { animation: none; } }
`,
    defs: clips,
  });
}

// ------------------------------------------------------------------ link buttons

const GLYPH_ICONS = {
  globe: (s) => `<g fill="none" stroke="${s}" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c2 1.7 3 3.8 3 6.25s-1 4.55-3 6.25c-2-1.7-3-3.8-3-6.25s1-4.55 3-6.25Z"/></g>`,
  mail: (s) => `<g fill="none" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.75" y="3.25" width="12.5" height="9.5" rx="2"/><path d="m2.5 4.75 5.5 4 5.5-4"/></g>`,
  linkedin: (s) => `<g fill="${s}"><rect x="2.4" y="6.2" width="2.3" height="7.4" rx=".4"/><circle cx="3.55" cy="3.6" r="1.4"/><path d="M6.6 6.2h2.2v1c.5-.8 1.4-1.2 2.4-1.2 1.9 0 2.8 1.2 2.8 3.2v4.4h-2.3V9.7c0-1-.4-1.6-1.3-1.6s-1.5.7-1.5 1.7v3.8H6.6Z"/></g>`,
};

export function button(link, primary, theme) {
  const t = THEMES[theme];
  const H = 36, PAD = 14, ICON = 16, GAP = 8, SIZE = 13.5;
  const color = primary ? t.onAccent : t.ink;
  const width = Math.ceil(PAD + ICON + GAP + measure(link.label, 'strong', SIZE) + PAD);
  const c = canvas(width, H, link.label);
  c.add(primary
    ? `<rect width="${width}" height="${H}" rx="8" fill="${t.accent}"/>`
    : `<rect x=".5" y=".5" width="${width - 1}" height="${H - 1}" rx="7.5" fill="${t.tint}" fill-opacity="${t.tintOpacity}" stroke="${t.faint}"/>`);
  c.add(`<g transform="translate(${PAD} ${(H - ICON) / 2})">${GLYPH_ICONS[link.icon](color)}</g>`);
  c.text(link.label, { face: 'strong', size: SIZE, x: PAD + ICON + GAP, y: H / 2 + 4.9, fill: color });
  return c.render();
}

// ------------------------------------------------------------------ stack cards

const CARD_W = 410;

export function stackLayout(card) {
  const CHIP_H = 28, PAD = 10, ICON = 13, GAP = 6, SIZE = 12.5, CHIP_GAP = 7, ROW_GAP = 7;
  const placed = [];
  let y = 0;
  for (const group of card.groups) {
    placed.push({ kind: 'label', text: group.label, y: y + 11 });
    y += 22;
    let x = 0;
    for (const [label, logo] of group.items) {
      const w = Math.ceil(PAD + (logo ? ICON + GAP : 0) + measure(label, 'regular', SIZE) + PAD);
      if (x > 0 && x + w > CARD_W) {
        x = 0;
        y += CHIP_H + ROW_GAP;
      }
      placed.push({ kind: 'chip', label, logo, x, y, w });
      x += w + CHIP_GAP;
    }
    y += CHIP_H + 20;
  }
  return { placed, height: y - 20, CHIP_H, PAD, ICON, GAP, SIZE };
}

export function stackCard(card, height, theme) {
  const t = THEMES[theme];
  const L = stackLayout(card);
  const c = canvas(CARD_W, height, card.groups.map((g) => `${g.label}: ${g.items.map((i) => i[0]).join(', ')}`).join('. '));
  for (const item of L.placed) {
    if (item.kind === 'label') {
      c.text(item.text, { size: 12, x: 0, y: item.y, fill: t.muted });
      continue;
    }
    c.add(`<rect x="${item.x + 0.5}" y="${item.y + 0.5}" width="${item.w - 1}" height="${L.CHIP_H - 1}" rx="6.5" fill="${t.tint}" fill-opacity="${t.tintOpacity}" stroke="${t.faint}"/>`);
    let x = item.x + L.PAD;
    if (item.logo) {
      if (!logos[item.logo]) throw new Error(`No logo named "${item.logo}" in scripts/icons.mjs`);
      c.add(`<path fill="${t.accent}" transform="translate(${x} ${item.y + (L.CHIP_H - L.ICON) / 2}) scale(${(L.ICON / 24).toFixed(4)})" d="${logos[item.logo]}"/>`);
      x += L.ICON + L.GAP;
    }
    c.text(item.label, { size: L.SIZE, x, y: item.y + L.CHIP_H / 2 + 4.5, fill: t.ink, opacity: 0.9 });
  }
  return c.render();
}

// ------------------------------------------------------------------ project cards

export function projectCard(project, theme) {
  const t = THEMES[theme];
  const H = 136, PAD = 18;
  const c = canvas(CARD_W, H, `${project.name}. ${project.description}`);
  c.add(`<rect x=".5" y=".5" width="${CARD_W - 1}" height="${H - 1}" rx="10" fill="${t.tint}" fill-opacity="${t.tintOpacity}" stroke="${t.faint}"/>`);
  c.text(project.name, { face: 'display', size: 18, x: PAD, y: 36, fill: t.ink, tracking: -0.005 });
  c.text('↗', { size: 16, x: CARD_W - PAD, y: 36, fill: t.muted, anchor: 'end' });
  wrap(project.description, 'regular', 13, CARD_W - PAD * 2).slice(0, 2).forEach((line, i) => {
    c.text(line, { size: 13, x: PAD, y: 61 + i * 19, fill: t.muted });
  });
  let x = PAD;
  const y = H - 19;
  const items = [...(project.highlight ? [{ label: project.highlight, strong: true }] : []), ...project.tags.map((label) => ({ label }))];
  items.forEach((item, i) => {
    if (i > 0) {
      c.add(`<circle cx="${n(x + 8)}" cy="${y - 4}" r="1.3" fill="${t.faint}"/>`);
      x += 16;
    }
    x += c.text(item.label, { face: item.strong ? 'strong' : 'regular', size: 12, x, y, fill: item.strong ? t.accent : t.ink, opacity: item.strong ? undefined : 0.82 });
  });
  return c.render();
}

// ------------------------------------------------------------------ contribution cards

export const fmt = (v) => v.toLocaleString('en-US');

export function totalCard(years, theme) {
  const t = THEMES[theme];
  const total = years.reduce((sum, y) => sum + y.count, 0);
  const firstYear = years[0]?.year ?? new Date().getUTCFullYear();
  const current = years.at(-1);
  const best = years.reduce((a, b) => (b.count > a.count ? b : a), years[0] ?? { year: firstYear, count: 0 });
  const c = canvas(CARD_W, 150, `${fmt(total)} contributions since ${firstYear}`);

  c.text(fmt(total), { face: 'display', size: 56, x: 0, y: 58, fill: t.ink, tracking: -0.015 });
  c.text(`contributions since ${firstYear}`, { size: 15, x: 1, y: 86, fill: t.muted });

  const notes = [];
  if (years.length > 1 && best.count > 0) notes.push([fmt(best.count), ` in ${best.year}, the busiest year${best === current ? ' so far' : ''}`]);
  if (current && current !== best) notes.push([fmt(current.count), ` so far in ${current.year}`]);
  notes.forEach(([figure, rest], i) => {
    const y = 120 + i * 20;
    const w = c.text(figure, { face: 'strong', size: 13, x: 1, y, fill: t.ink });
    c.text(rest, { size: 13, x: 1 + w, y, fill: t.muted });
  });
  return c.render();
}

export function yearsCard(years, theme) {
  const t = THEMES[theme];
  const base = 118, maxHeight = 84;
  const peak = Math.max(1, ...years.map((y) => y.count));
  const slot = Math.min(66, CARD_W / Math.max(1, years.length));
  const barWidth = Math.max(6, Math.min(16, slot * 0.3));
  const shortLabels = slot < 44, showValues = slot >= 40;
  const c = canvas(CARD_W, 150, `Contributions by year: ${years.map((y) => `${y.year} ${fmt(y.count)}`).join(', ')}`);

  years.forEach(({ year, count }, i) => {
    const cx = slot * i + slot / 2;
    const h = count === 0 ? 1 : Math.max(2, (count / peak) * maxHeight);
    const top = base - h;
    const isPeak = count === peak;
    c.add(`<rect x="${n(cx - barWidth / 2)}" y="${n(top)}" width="${n(barWidth)}" height="${n(h)}" rx="1.5" fill="${t.accent}"${isPeak ? '' : ' opacity=".42"'}/>`);
    if (showValues) c.text(fmt(count), { face: isPeak ? 'strong' : 'regular', size: 11, x: cx, y: top - 7, fill: isPeak ? t.ink : t.muted, anchor: 'middle' });
    c.text(shortLabels ? `’${String(year).slice(2)}` : String(year), { size: 12, x: cx, y: base + 20, fill: t.muted, anchor: 'middle' });
  });
  c.add(`<line x1="0" x2="${n(slot * years.length)}" y1="${base + 0.5}" y2="${base + 0.5}" stroke="${t.faint}"/>`);
  return c.render();
}

// ------------------------------------------------------------------ profile views

const EYE = (s) => `<g fill="none" stroke="${s}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.2 7s2.2-4.2 5.8-4.2S12.8 7 12.8 7s-2.2 4.2-5.8 4.2S1.2 7 1.2 7Z"/><circle cx="7" cy="7" r="1.9"/></g>`;

// Drawn like the stack chips. `count` is null when the number could not be read.
export function viewsCard(count, theme) {
  const t = THEMES[theme];
  const H = 28, PAD = 10, ICON = 14, GAP = 7, SIZE = 12.5;
  const figure = count === null ? '–' : fmt(count);
  const label = ' profile views';
  const width = Math.ceil(PAD + ICON + GAP + measure(figure, 'strong', SIZE) + measure(label, 'regular', SIZE) + PAD);
  const c = canvas(width, H, count === null ? 'Profile views' : `${figure} profile views`);
  c.add(`<rect x=".5" y=".5" width="${width - 1}" height="${H - 1}" rx="6.5" fill="${t.tint}" fill-opacity="${t.tintOpacity}" stroke="${t.faint}"/>`);
  c.add(`<g transform="translate(${PAD} ${(H - ICON) / 2})">${EYE(t.accent)}</g>`);
  const x = PAD + ICON + GAP;
  const w = c.text(figure, { face: 'strong', size: SIZE, x, y: H / 2 + 4.5, fill: t.ink });
  c.text(label, { size: SIZE, x: x + w, y: H / 2 + 4.5, fill: t.muted });
  return c.render();
}

// The counter itself is the invisible komarev.com image in README.md, which counts a view
// each time GitHub loads it. Reading the badge from here does not add a view: the service
// only counts requests that come from GitHub's image proxy.
export async function profileViews(login, timeout = 15000) {
  const res = await fetch(`https://komarev.com/ghpvc/?username=${encodeURIComponent(login)}&style=flat`, {
    headers: { 'user-agent': `${login}-profile-readme` },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`counter answered ${res.status}`);
  const badge = await res.text();
  const figure = [...badge.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].trim()).reverse().find((text) => /^\d[\d,]*$/.test(text));
  if (!figure) throw new Error('no number in the counter badge');
  return Number(figure.replaceAll(',', ''));
}

// If the counter cannot be read, keep the card that is already published instead of blanking it.
export async function publishedViewsCard(theme, repo = process.env.GITHUB_REPOSITORY) {
  if (!repo) return null;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/output/views-${theme}.svg`, { signal: AbortSignal.timeout(15000) });
    const svg = res.ok ? await res.text() : '';
    return svg.startsWith('<svg') ? svg : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ GitHub data

async function graphql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': `${variables.login}-profile-readme` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) throw new Error(`GitHub API ${res.status}: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

// Returns [{ year, count }] oldest first, one entry per year since the first contribution.
export async function contributionsByYear(sample) {
  if (sample) {
    return [
      { year: 2021, count: 386 }, { year: 2022, count: 912 }, { year: 2023, count: 547 },
      { year: 2024, count: 1304 }, { year: 2025, count: 978 }, { year: 2026, count: 731 },
    ];
  }
  const login = LOGIN;
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN, or pass --sample.');

  const first = await graphql(token, 'query($login: String!) { user(login: $login) { contributionsCollection { contributionYears } } }', { login });
  if (!first.user) throw new Error(`User "${login}" not found.`);
  const active = first.user.contributionsCollection.contributionYears;
  if (!active.length) return [];

  // The API only accepts ranges of up to a year, so ask for every year in one request.
  const years = [];
  for (let y = Math.min(...active); y <= new Date().getUTCFullYear(); y++) years.push(y);
  const fields = years.map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } }`);
  const data = await graphql(token, `query($login: String!) { user(login: $login) { ${fields.join('\n')} } }`, { login });
  return years.map((year) => ({ year, count: data.user[`y${year}`].contributionCalendar.totalContributions }));
}
