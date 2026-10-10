#!/usr/bin/env node
// Writes the profile graphics. No dependencies.
//
//   node scripts/build.mjs static            banner, buttons, stack and project cards -> assets/
//   node scripts/build.mjs stats             contribution and view-count cards, live  -> dist/
//   node scripts/build.mjs stats --sample    the same cards with made-up numbers
//
// What the graphics say is in scripts/content.mjs; how they are drawn is in scripts/draw.mjs.

import { mkdir, writeFile } from 'node:fs/promises';
import { profile } from './content.mjs';
import {
  LOGIN, banner, button, stackLayout, stackCard, projectCard,
  totalCard, yearsCard, viewsCard, contributionsByYear, profileViews, publishedViewsCard, fmt,
} from './draw.mjs';


async function writeBoth(dir, name, draw) {
  for (const theme of ['light', 'dark']) await writeFile(`${dir}/${name}-${theme}.svg`, draw(theme));
}

const [mode, ...flags] = process.argv.slice(2);

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

  // The output branch holds only generated images, so tell Vercel not to deploy it.
  await writeFile(`${dir}/vercel.json`, JSON.stringify({ git: { deploymentEnabled: false } }, null, 2) + '\n');
} else {
  console.error('Usage: node scripts/build.mjs static | stats [--sample]');
  process.exit(1);
}
