# Nioti

Local-first Arabic Coptic saints encyclopedia with a daily streak and gamification system.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5000/>.

## Project layout

- `public/` — browser pages, styles, client code, PWA files, and `saints_data.json`.
- `server/` — Express API and static-file server.
- `scripts/` — scraping, Firebase seeding, and diagnostic utilities.
- `config/` — local Firebase service-account configuration (keep private).

The development API reads the UTF-8 dataset from `public/saints_data.json`. If the API is unavailable, the browser loads that same file directly. User favorites, streaks, points, and activity history remain in local storage.

## Useful commands

```bash
npm run dev          # development server with nodemon
npm start            # production-style server
npm run scrape       # refresh public/saints_data.json
npm run seed         # seed Firebase from scraped data
npm run test:encoding
npm run test:scraper
```
