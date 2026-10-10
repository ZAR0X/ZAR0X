#!/usr/bin/env node
// Generates the contribution cards shown on the profile README.
//
//   dist/contributions-total.svg   all-time contribution count
//   dist/contributions-years.svg   the same count, split by year
//
// Runs in GitHub Actions with the built-in GITHUB_TOKEN. No dependencies.
// Preview locally without a token:  node scripts/stats.mjs --sample

import { mkdir, writeFile } from 'node:fs/promises';

const USER = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.OUT_DIR || 'dist';
const SAMPLE = process.argv.includes('--sample');

// ---------------------------------------------------------------- data

async function graphql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `bearer ${TOKEN}`,
      'content-type': 'application/json',
      'user-agent': `${USER}-profile-readme`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    throw new Error(`GitHub API ${res.status}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data;
}

// Returns [{ year, count }] oldest first, one entry per year since the first contribution.
async function contributionsByYear() {
  if (SAMPLE) {
    return [
      { year: 2021, count: 386 }, { year: 2022, count: 912 }, { year: 2023, count: 547 },
      { year: 2024, count: 1304 }, { year: 2025, count: 978 }, { year: 2026, count: 731 },
    ];
  }
  if (!USER || !TOKEN) throw new Error('Set GH_USER and GITHUB_TOKEN, or pass --sample.');

  const first = await graphql(
    'query($login: String!) { user(login: $login) { contributionsCollection { contributionYears } } }',
    { login: USER },
  );
  if (!first.user) throw new Error(`User "${USER}" not found.`);
  const active = first.user.contributionsCollection.contributionYears;
  if (!active.length) return [];

  // The API only accepts ranges of up to a year, so ask for every year in one request.
  const years = [];
  for (let y = Math.min(...active); y <= new Date().getUTCFullYear(); y++) years.push(y);
  const fields = years.map((y) =>
    `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } }`,
  );
  const data = await graphql(`query($login: String!) { user(login: $login) { ${fields.join('\n')} } }`, { login: USER });
  return years.map((year) => ({ year, count: data.user[`y${year}`].contributionCalendar.totalContributions }));
}

// ---------------------------------------------------------------- drawing

const W = 410;
const H = 150;
const fmt = (n) => n.toLocaleString('en-US');

// Light and dark colours live in one file; the browser picks by colour scheme.
const STYLE = `
  :root { --ink: #1f2328; --muted: #59636e; --faint: #d1d9e0; --accent: #6a4ee0; }
  @media (prefers-color-scheme: dark) {
    :root { --ink: #f0f6fc; --muted: #9198a1; --faint: #3d444d; --accent: #a48cf2; }
  }
  text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; fill: var(--muted); }
  .ink { fill: var(--ink); }
  .strong { fill: var(--ink); font-weight: 600; }
  .bar { fill: var(--accent); }
  .rule { stroke: var(--faint); }`;

const frame = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">${title}</title>
<style>${STYLE}
</style>
${body}
</svg>
`;

// Digit outlines from Inter Display SemiBold (SIL Open Font License 1.1), so the headline
// number matches the name in the banner on every device. Units are 1/2048 em.
const UPM = 2048;
const GLYPHS = {
  "0": { w: 1306, d: 'M653 24C1013 24 1234 -272 1234 -744C1234 -1218 1013 -1514 653 -1514C293 -1514 72 -1217 72 -744C72 -272 293 24 653 24ZM653 -194C448 -194 322 -402 322 -744C322 -1088 448 -1296 653 -1296C859 -1296 984 -1088 984 -744C984 -402 859 -194 653 -194Z' },
  "1": { w: 779, d: 'M656 -1490H412L42 -1251V-1009L399 -1240H401V0H656Z' },
  "2": { w: 1200, d: 'M81 0H1120V-218H441V-220L785 -525C997 -710 1113 -851 1113 -1054C1113 -1331 900 -1514 603 -1514C284 -1514 80 -1303 80 -988H325C325 -1179 429 -1296 603 -1296C764 -1296 865 -1198 865 -1042C865 -897 773 -808 622 -674L81 -201Z' },
  "3": { w: 1255, d: 'M632 24C953 24 1183 -161 1183 -420C1183 -597 1060 -743 858 -771V-774C1025 -814 1137 -935 1137 -1097C1137 -1340 921 -1514 627 -1514C315 -1514 110 -1318 110 -1047H361C361 -1206 465 -1305 626 -1305C782 -1305 887 -1215 887 -1073C887 -945 775 -863 604 -863H476V-660H604C794 -660 922 -569 922 -431C922 -284 802 -189 629 -189C445 -189 336 -298 336 -484H79C79 -198 282 24 632 24Z' },
  "4": { w: 1319, d: 'M56 -334H805V0H1056V-334H1262V-547H1056V-1490H731L56 -542ZM805 -547H322V-549L804 -1227H805Z' },
  "5": { w: 1211, d: 'M605 21C926 21 1139 -194 1139 -498C1139 -789 928 -1004 658 -1004C528 -1004 421 -961 338 -875H336L366 -1271H1054V-1490H131L84 -626H329C366 -734 473 -794 615 -794C776 -794 887 -668 887 -492C887 -316 774 -191 606 -191C447 -191 328 -300 318 -449H64C78 -171 298 21 605 21Z' },
  "6": { w: 1241, d: 'M636 24C949 24 1169 -183 1169 -484C1169 -770 963 -981 681 -981C525 -981 392 -915 320 -801H318C318 -1097 426 -1302 654 -1302C791 -1302 880 -1222 904 -1096H1154C1128 -1339 936 -1514 652 -1514C267 -1514 72 -1193 72 -699C72 -240 278 24 636 24ZM635 -191C478 -191 354 -319 354 -483C354 -646 480 -773 638 -773C797 -773 917 -648 917 -484C917 -319 793 -191 635 -191Z' },
  "7": { w: 1103, d: 'M149 0H420L1056 -1265V-1490H46V-1266H789V-1265Z' },
  "8": { w: 1236, d: 'M618 24C941 24 1164 -149 1164 -399C1164 -598 1022 -749 821 -776C995 -807 1112 -933 1112 -1111C1112 -1348 908 -1514 618 -1514C328 -1514 123 -1346 123 -1111C123 -932 240 -806 415 -776C213 -749 72 -599 72 -399C72 -149 294 24 618 24ZM618 -178C449 -178 336 -274 336 -416C336 -560 454 -665 618 -665C781 -665 899 -560 899 -416C899 -273 786 -178 618 -178ZM618 -868C474 -868 377 -957 377 -1089C377 -1221 473 -1309 618 -1309C762 -1309 858 -1221 858 -1089C858 -956 761 -868 618 -868Z' },
  "9": { w: 1241, d: 'M587 24C972 24 1169 -297 1169 -791C1169 -1250 963 -1514 605 -1514C292 -1514 72 -1309 72 -1009C72 -723 279 -514 560 -514C716 -514 847 -575 919 -689H921C921 -393 812 -188 584 -188C447 -188 356 -268 332 -394H82C109 -151 302 24 587 24ZM603 -722C445 -722 324 -844 324 -1009C324 -1174 448 -1299 607 -1299C763 -1299 887 -1174 887 -1010C887 -847 762 -722 603 -722Z' },
  ",": { w: 484, d: 'M50 302H229L378 -231H129Z' },
};

function numeral(text, x, baseline, size) {
  const scale = size / UPM;
  const tracking = -0.02 * UPM;
  let cursor = 0;
  let paths = '';
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    paths += `<path transform="translate(${cursor})" d="${g.d}"/>`;
    cursor += g.w + tracking;
  }
  return `<g class="ink" transform="translate(${x} ${baseline}) scale(${scale.toFixed(5)})">${paths}</g>`;
}

function totalCard(years) {
  const total = years.reduce((sum, y) => sum + y.count, 0);
  const firstYear = years[0]?.year ?? new Date().getUTCFullYear();
  const current = years.at(-1);
  const best = years.reduce((a, b) => (b.count > a.count ? b : a), years[0] ?? { year: firstYear, count: 0 });

  const notes = [];
  if (years.length > 1 && best.count > 0) {
    notes.push(`<tspan class="strong">${fmt(best.count)}</tspan> in ${best.year}, the busiest year${best === current ? ' so far' : ''}`);
  }
  if (current && current !== best) {
    notes.push(`<tspan class="strong">${fmt(current.count)}</tspan> so far in ${current.year}`);
  }

  return frame(
    `${fmt(total)} contributions since ${firstYear}`,
    [
      numeral(fmt(total), 0, 58, 56),
      `<text x="1" y="86" font-size="15">contributions since ${firstYear}</text>`,
      ...notes.map((note, i) => `<text x="1" y="${120 + i * 20}" font-size="13">${note}</text>`),
    ].join('\n'),
  );
}

function yearsCard(years) {
  const base = 118;        // y of the baseline the bars stand on
  const maxHeight = 84;
  const peak = Math.max(1, ...years.map((y) => y.count));
  const slot = Math.min(66, W / Math.max(1, years.length));
  const barWidth = Math.max(6, Math.min(16, slot * 0.3));
  const shortLabels = slot < 44;
  const showValues = slot >= 40;

  const bars = years.map(({ year, count }, i) => {
    const cx = slot * i + slot / 2;
    const h = count === 0 ? 1 : Math.max(2, (count / peak) * maxHeight);
    const top = base - h;
    return [
      `<rect class="bar" x="${(cx - barWidth / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"${count === peak ? '' : ' opacity=".42"'}/>`,
      showValues ? `<text x="${cx.toFixed(1)}" y="${(top - 7).toFixed(1)}" font-size="11" text-anchor="middle"${count === peak ? ' class="strong"' : ''}>${fmt(count)}</text>` : '',
      `<text x="${cx.toFixed(1)}" y="${base + 20}" font-size="12" text-anchor="middle">${shortLabels ? `’${String(year).slice(2)}` : year}</text>`,
    ].join('');
  });

  return frame(
    `Contributions by year: ${years.map((y) => `${y.year} ${fmt(y.count)}`).join(', ')}`,
    [
      ...bars,
      `<line class="rule" x1="0" x2="${(slot * years.length).toFixed(1)}" y1="${base + 0.5}" y2="${base + 0.5}"/>`,
    ].join('\n'),
  );
}

// ---------------------------------------------------------------- run

const years = await contributionsByYear();
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/contributions-total.svg`, totalCard(years));
await writeFile(`${OUT}/contributions-years.svg`, yearsCard(years));
console.log(`${fmt(years.reduce((s, y) => s + y.count, 0))} contributions across ${years.length} years -> ${OUT}/`);
