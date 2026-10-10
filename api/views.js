// Live profile-view card, drawn on every request so the number is always current.
//
//   /api/views?theme=dark    /api/views?theme=light
//
// Deployed on Vercel (import this repository as a project; no settings needed). The count
// comes from komarev.com, where the invisible image in README.md records each view. Reading
// it from here does not add a view.

import { viewsCard, profileViews, publishedViewsCard } from '../scripts/draw.mjs';
import { profile } from '../scripts/content.mjs';

let lastKnown = null; // survives between requests while the function stays warm

export default async function handler(req, res) {
  const theme = req.query?.theme === 'light' ? 'light' : 'dark';

  let count = lastKnown;
  try {
    count = await profileViews(profile.user, 2500);
    lastKnown = count;
  } catch (error) {
    console.warn(`View count unavailable: ${error.message}`);
  }

  // Never answer with an error image: fall back to the last number seen, then to the card the
  // GitHub workflow last published, then to a card without a number.
  const card = count === null
    ? (await publishedViewsCard(theme, `${profile.user}/${profile.user}`)) ?? viewsCard(null, theme)
    : viewsCard(count, theme);

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate'); // GitHub's image proxy must not cache it
  res.status(200).send(card);
}
