#!/usr/bin/env node
// Draws every graphic on the profile README. No dependencies.
//
//   node scripts/build.mjs static            banner, buttons, stack and project cards -> assets/
//   node scripts/build.mjs stats             contribution and view-count cards, live  -> dist/
//   node scripts/build.mjs stats --sample    the same cards with made-up numbers
//
// Each graphic is written twice, as -light.svg and -dark.svg, and the README picks one
// with a <picture> element. Text is drawn as outlines so it looks the same on every device.

import { mkdir, writeFile } from 'node:fs/promises';
import * as fonts from './font.mjs';
import { logos } from './icons.mjs';
import { profile } from './content.mjs';

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

// A displaced plane in perspective, the kind of surface a vertex shader makes.
function surface() {
  const height = (x, z) =>
    0.62 * Math.sin(1.55 * x + 2.2 * z + 0.2) +
    0.34 * Math.sin(2.9 * x - 3.6 * z + 1.9) +
    0.16 * Math.sin(5.3 * x + 1.1 * z + 2.9);
  const project = (x, z) => {
    const depth = 1 + 3.4 * z;
    return [600 + (x * 470) / depth, 2 + (176 - 52 * height(x, z)) / depth];
  };
  const path = (points) => 'M' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
  const ROWS = 20, COLS = 34, STEPS = 80;
  const rows = [];
  for (let j = 0; j < ROWS; j++) {
    const z = (j / (ROWS - 1)) ** 1.5;
    const points = [];
    for (let i = 0; i <= STEPS; i++) points.push(project(-2.4 + (4.8 * i) / STEPS, z));
    rows.push({ z, d: path(points) });
  }
  const cols = [];
  for (let i = 0; i <= COLS; i++) {
    const points = [];
    for (let k = 0; k <= 28; k++) points.push(project(-2.4 + (4.8 * i) / COLS, (k / 28) ** 1.5));
    cols.push(path(points));
  }
  return { rows, cols };
}

function banner(theme) {
  const t = THEMES[theme];
  const W = 846, H = 214;
  const c = canvas(W, H, `${profile.name}. ${profile.tagline}.`);
  const { rows, cols } = surface();

  c.add(`<g mask="url(#fade)">`);
  c.add(`<g class="col" opacity="${theme === 'dark' ? 0.28 : 0.34}">${cols.map((d) => `<path d="${d}"/>`).join('')}</g>`);
  rows.forEach(({ z, d }, j) => {
    c.add(`<path class="row" pathLength="1" opacity="${(0.92 - 0.74 * z).toFixed(2)}" style="animation-delay:${j * 55}ms" d="${d}"/>`);
  });
  c.add(`</g>`);

  c.text(profile.name, { face: 'display', size: 60, x: 0, y: 112, fill: t.ink, tracking: -0.012 });
  const taglineWidth = c.text(profile.tagline, { face: 'regular', size: 17, x: 1, y: 147, fill: t.muted });

  // The surface fades out before it reaches the text.
  const fadeFrom = Math.min(0.5, (taglineWidth - 40) / W);
  return c.render({
    style: `
  .row, .col { fill: none; stroke: ${t.accent}; stroke-linecap: round; stroke-linejoin: round; }
  .row { stroke-width: 1; stroke-dasharray: 1; animation: draw 1.6s cubic-bezier(.2,.7,.2,1) backwards; }
  .col { stroke-width: .6; animation: fade 1.4s ease-out 1.1s backwards; }
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .row, .col { animation: none; } }
`,
    defs: `<linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="${fadeFrom.toFixed(3)}" stop-color="#fff" stop-opacity="0"/><stop offset="${(fadeFrom + 0.3).toFixed(3)}" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#g)"/></mask>`,
  });
}

// ------------------------------------------------------------------ link buttons

const GLYPH_ICONS = {
  globe: (s) => `<g fill="none" stroke="${s}" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c2 1.7 3 3.8 3 6.25s-1 4.55-3 6.25c-2-1.7-3-3.8-3-6.25s1-4.55 3-6.25Z"/></g>`,
  mail: (s) => `<g fill="none" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.75" y="3.25" width="12.5" height="9.5" rx="2"/><path d="m2.5 4.75 5.5 4 5.5-4"/></g>`,
  linkedin: (s) => `<g fill="${s}"><rect x="2.4" y="6.2" width="2.3" height="7.4" rx=".4"/><circle cx="3.55" cy="3.6" r="1.4"/><path d="M6.6 6.2h2.2v1c.5-.8 1.4-1.2 2.4-1.2 1.9 0 2.8 1.2 2.8 3.2v4.4h-2.3V9.7c0-1-.4-1.6-1.3-1.6s-1.5.7-1.5 1.7v3.8H6.6Z"/></g>`,
};

function button(link, primary, theme) {
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

function stackLayout(card) {
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

function stackCard(card, height, theme) {
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

function projectCard(project, theme) {
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

const fmt = (v) => v.toLocaleString('en-US');

function totalCard(years, theme) {
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

function yearsCard(years, theme) {
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
function viewsCard(count, theme) {
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
async function profileViews(login) {
  const res = await fetch(`https://komarev.com/ghpvc/?username=${encodeURIComponent(login)}&style=flat`, {
    headers: { 'user-agent': `${login}-profile-readme` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`counter answered ${res.status}`);
  const badge = await res.text();
  const figure = [...badge.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].trim()).reverse().find((text) => /^\d[\d,]*$/.test(text));
  if (!figure) throw new Error('no number in the counter badge');
  return Number(figure.replaceAll(',', ''));
}

// If the counter cannot be read, keep the card that is already published instead of blanking it.
async function publishedViewsCard(theme) {
  const repo = process.env.GITHUB_REPOSITORY;
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
async function contributionsByYear(sample) {
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

// ------------------------------------------------------------------ run

async function writeBoth(dir, name, draw) {
  for (const theme of ['light', 'dark']) await writeFile(`${dir}/${name}-${theme}.svg`, draw(theme));
}

const [mode, ...flags] = process.argv.slice(2);
const LOGIN = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER || profile.user;

if (mode === 'static') {
  const dir = process.env.OUT_DIR || 'assets';
  await mkdir(dir, { recursive: true });
  await writeBoth(dir, 'banner', banner);
  for (const [i, link] of profile.links.entries()) await writeBoth(dir, `link-${link.id}`, (theme) => button(link, i === 0, theme));
  const stackHeight = Math.max(...profile.stack.map((card) => stackLayout(card).height));
  for (const card of profile.stack) await writeBoth(dir, card.id, (theme) => stackCard(card, stackHeight, theme));
  for (const project of profile.work) await writeBoth(dir, `work-${project.id}`, (theme) => projectCard(project, theme));
  console.log(`Static graphics written to ${dir}/`);
} else if (mode === 'stats') {
  const dir = process.env.OUT_DIR || 'dist';
  const sample = flags.includes('--sample');
  const years = await contributionsByYear(sample);
  await mkdir(dir, { recursive: true });
  await writeBoth(dir, 'contributions-total', (theme) => totalCard(years, theme));
  await writeBoth(dir, 'contributions-years', (theme) => yearsCard(years, theme));
  console.log(`${fmt(years.reduce((s, y) => s + y.count, 0))} contributions across ${years.length} years -> ${dir}/`);

  // A view count that cannot be read must not stop the snake and contribution cards publishing.
  let views = null;
  try {
    views = sample ? 282 : await profileViews(LOGIN);
    console.log(`${fmt(views)} profile views -> ${dir}/`);
  } catch (error) {
    console.warn(`Could not read the profile view count (${error.message}); keeping the published card.`);
  }
  for (const theme of ['light', 'dark']) {
    const card = views === null ? (await publishedViewsCard(theme)) ?? viewsCard(null, theme) : viewsCard(views, theme);
    await writeFile(`${dir}/views-${theme}.svg`, card);
  }
} else {
  console.error('Usage: node scripts/build.mjs static | stats [--sample]');
  process.exit(1);
}
