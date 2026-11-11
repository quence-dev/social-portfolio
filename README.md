# Social Video Work

Static portfolio gallery built from a manually maintained CSV catalog.
The project includes Tailwind CSS for fast utility-class changes, alongside the small custom stylesheet that owns the gallery and modal layout.

## Local development

```sh
npm install
npm run dev
```

`data/posts.csv` is the source of truth. Keep one row per public upload. A `video_id` groups cross-posts and re-uploads of the same finished work; `post_id` and `url` must stay unique. Set `include` to `TRUE` to publish a row. `shoot_date` is optional when it is unavailable.

Run the TypeScript-, React-, and accessibility-aware lint check before committing application or maintenance-script changes:

```sh
npm run lint
```

If a Google Sheets export only contains new posts, merge it into the local catalog instead of replacing it. Existing rows—including their cached publish dates, views, and likes—are left untouched:

```sh
npm run posts:merge -- --input /absolute/path/to/new-posts.csv
```

The merge matches on both `post_id` and URL, appends only genuinely new rows, and stops on a mismatched ID/URL pair. Then run:

```sh
npm run import
```

This validates the catalog and updates `src/data/gallery.generated.json`.

## Creator profiles

`src/data/creator-profiles.json` maps the creator names currently used by the CSV to their display names, handles, and optional profile images. Creator cards and filters use the handle; individual creator pages show both the full name and handle. Profile images belong in `public/pfp/` and are referenced with paths such as `/pfp/alberta.tech.jpg`.

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

## Importing Instagram metrics

Use a Reel-scraper JSON export to update each matching Instagram post's upload timestamp, views, and likes in `data/posts.csv`.

```sh
npm run metrics:instagram -- --input /absolute/path/to/reel-scraper.json
npm run build
```

The import requires a complete one-to-one match with included Instagram posts and writes nothing if any API record cannot be matched.

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

It accepts the same `-- --headless`, `-- --limit 1`, and `-- --overwrite` options. Here, `--limit` is the number of new thumbnails to save—existing files are skipped without consuming it. It processes one public post at a time and retries the same post after 120 seconds only when Toolzin displays its request-limit message.

## Downloading thumbnails with FastVideoSave

This alternative submits an Instagram URL to FastVideoSave and saves its returned CDN image directly as `public/thumbnails/<post_id>.jpg`, without using the browser Downloads folder.

```sh
npm run thumbnails:fastvideosave
```

It accepts the same `-- --headless`, `-- --limit 1`, and `-- --overwrite` options. It waits briefly for FastVideoSave to submit the URL automatically, then uses its **Paste** button if needed.

## Downloading thumbnails with Snaplytics

Snaplytics is another alternative. It waits for its automatic verification and tries the returned **Download thumbnail faster** CDN link first, then its direct Instagram-data link if necessary. Images save directly under the matching post ID.

```sh
npm run thumbnails:snaplytics
```

It accepts the same `-- --headless`, `-- --limit 1`, and `-- --overwrite` options.

## Roadmap

- Visualize creator collaborations based on creators appearing in one another's videos.
- Improve cross-post handling with modal tabs or a carousel, including clear aggregated versus per-upload statistics.
- Add a creator-focused gallery view alongside the current chronological video grid.

## Deploying

Push `main`. The included GitHub Actions workflow builds the site and deploys it to GitHub Pages. In the repository’s **Settings → Pages**, set the deployment source to **GitHub Actions** once.
