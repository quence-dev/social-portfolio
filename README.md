# Social Video Work

Static portfolio gallery built from a manually maintained CSV catalog.
The project includes Tailwind CSS for fast utility-class changes, alongside the small custom stylesheet that owns the gallery and modal layout.

## Local development

```sh
npm install
npm run dev
```

`data/posts.csv` is the source of truth. Keep one row per public upload. A `video_id` groups cross-posts and re-uploads of the same finished work; `post_id` and `url` must stay unique. Set `include` to `TRUE` to publish a row.

After replacing the CSV, run:

```sh
npm run import
```

This validates the catalog and updates `src/data/gallery.generated.json`.

## Refreshing Instagram data

Install Playwright's Chromium once, then create a local, gitignored Instagram session:

```sh
npx playwright install chromium
npm run refresh -- --login
```

Log in through the browser window, then return to the terminal and press Enter. To collect currently available thumbnails, publish dates, views, and likes:

```sh
npm run refresh
npm run import
```

Commit the updated `data/refresh.json`, `public/thumbnails/`, and generated gallery data so the GitHub Pages deployment contains the cached results. The `.auth/` directory is intentionally never committed.

## Downloading thumbnails with Trendsee

This uses the public Trendsee downloader to save each included Instagram thumbnail as `public/thumbnails/<post_id>.jpg`. It skips files already on disk and intentionally runs one request at a time.

```sh
npm run thumbnails
```

Pass `-- --headless` to keep the browser hidden, `-- --limit 1` to test one post, or `-- --overwrite` to replace existing image files.

## Downloading thumbnails with Toolzin

Toolzin is available as a separate explicit option. It opens the **Reels** tab, uses the returned **Save Thumbnail** link, and saves the image itself rather than using the browser Downloads folder—so it is named correctly from the start.

```sh
npm run thumbnails:toolzin
```

It accepts the same `-- --headless`, `-- --limit 1`, and `-- --overwrite` options. It processes one public post at a time, skips existing thumbnails, and does not switch providers automatically when a service signals a limit.

## Deploying

Push `main`. The included GitHub Actions workflow builds the site and deploys it to GitHub Pages. In the repository’s **Settings → Pages**, set the deployment source to **GitHub Actions** once.
