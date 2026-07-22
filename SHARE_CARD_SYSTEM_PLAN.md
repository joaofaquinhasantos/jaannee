# Share Card System Plan

Share cards are the distribution layer for JaanNee. Social features should make the card worth clicking, but rankings remain the product spine.

## Rendering Approach

- Add a public card image endpoint: `/api/share-card/dish/:id`.
- Render server-side HTML/CSS to an image with a deterministic 1200x630 output.
- Use the dish page as source of truth: dish name, Thai name, place, area, price, status, rank/comparison count, tried count, photo if available.
- Prefer a generated PNG over SVG so Facebook, X, Telegram, LINE, and WhatsApp previews all receive the same stable bitmap.
- Keep fallback cards useful when no dish photo exists: strong typography, JaanNee mark, category/status, and place context.
- Update dish detail meta tags to point `og:image` and `twitter:image` at the share-card endpoint instead of raw dish photos once the endpoint is implemented.

## Thai Font Embedding

- Bundle a Thai-capable font file in `public/fonts/` rather than relying on Google Fonts at render time.
- Use the same Thai face as the app where possible: IBM Plex Sans Thai for Thai text, Hanken Grotesk or the current display stack for Latin.
- Register fonts inside the renderer before layout so mixed English/Thai dish names do not shift between local, Lovable preview, and production.
- Keep card CSS explicit: no viewport units, no remote font imports, no client-only layout dependencies.

## Caching

- Cache by dish id plus a version input derived from fields that affect the image: `updated_at`, `photo_url`, `elo`, `comparisons_count`, `status`, `price_thb`, and place/category names.
- Send long-lived cache headers for versioned image URLs.
- If the endpoint is not versioned in the URL, use short edge caching and `ETag` so share previews eventually refresh.
- Avoid rendering on every request. First request generates the image, later requests serve cached output from storage or edge cache.
- Plan storage key shape: `share-cards/dishes/{dishId}/{contentHash}.png`.

## Implementation Order

1. Build the endpoint with a plain fallback card and local font loading.
2. Switch dish meta tags to the generated card URL.
3. Add cache/storage after the first renderer is proven stable.
4. Add visual test screenshots for English-only, Thai-only, mixed language, no-photo, and long dish/place names.
