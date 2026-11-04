# MGC CRM showcase

A standalone page for showing MGC CRM to firms before the full build is ready. It is separate from the app in `src/`.

`demo/` is a clickable demo of the lead journey from the build plan: firm onboarding, an enquiry arriving, the team working it, the engagement letter sent and signed, services provided, campaigns and reports. Open `demo/index.html` in a browser. Everything is simulated with sample data and nothing is sent.

It is plain HTML with no build step.

## Hosting

This branch publishes itself to GitHub Pages. Each push to `showcase/mgc-crm-demo` runs
`.github/workflows/showcase-pages.yml`, which builds the site with `scripts/build-showcase-site.sh`
and pushes it to the `gh-pages` branch:

- `/` — clickable MGC CRM demo (`/demo/` redirects here)
- `/app/` — the existing app, built with a base path (the only app change is
  `BrowserRouter basename={import.meta.env.BASE_URL}`, which is `/` locally, so dev is unaffected)

One-time setup: Settings → Pages → Build and deployment → Source "Deploy from a branch",
branch `gh-pages`, folder `/ (root)`.
