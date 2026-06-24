# Curiosity Engine

### 🔗 [**Live site → ericdataplus.github.io/curiosity-engine**](https://ericdataplus.github.io/curiosity-engine/)

*One click surfaces a random science topic from Wikipedia — runs entirely in your browser, no install.*

A small static web app that surfaces a random science topic from Wikipedia and lets you
follow your curiosity — read the full article, search YouTube for videos, bookmark topics,
and share them. No backend, no build step, no API keys.

## Features

- **Discover** — one click pulls a random article from a curated list of ~480 science topics
- Reads article summaries via the **Wikipedia REST API** (no API key required)
- **Watch on YouTube** — opens a YouTube search for the current topic
- **Read on Wikipedia** — opens the full article
- **Bookmarks**, **recently-viewed history**, and **shareable links** (all stored locally in your browser)
- **Light / dark theme** with your preference remembered
- Responsive layout for desktop and mobile

## Running locally

Because the app fetches `science_topics.csv` and the Wikipedia API, it must be served over
HTTP. (Opening `index.html` directly via `file://` falls back to a small built-in topic
list and won't load the full CSV.)

```bash
# from the project directory
python -m http.server 8000
# then open http://localhost:8000
```

Or deploy the folder as-is to any static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

## How it works

- Topics live in `science_topics.csv` (`category,topic`).
- `script.js` picks a random, not-recently-seen topic, fetches its summary from
  `https://en.wikipedia.org/api/rest_v1/page/summary/<title>`, and renders it.
- Bookmarks, history, and the theme preference are persisted in `localStorage`.

## Tech

- HTML5, CSS3, vanilla JavaScript (ES6+)
- Wikipedia REST API
- Font Awesome icons

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

- Wikipedia for providing free access to their content
- YouTube for their search functionality
- Font Awesome for the icons
