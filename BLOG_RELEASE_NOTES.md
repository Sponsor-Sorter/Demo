# Blog resource centre release — 11 October 2026

## Changes
- Rebuilt resource library and article pages using the existing grid header and canonical footer.
- Added search, topic/audience filters, sorting, pagination, reading times, contents, related reading, copy/share and print controls.
- Added ten original guides (roughly 500–560 words each); rewrote ten older entries. Preserved existing article IDs and dates.
- Included sponsor and creator walkthroughs, illustrative niche budgets, briefing, UGC, approvals, disclosures, reporting and safety.
- Added eleven original SVG editorial covers. No invented testimonials or campaign statistics; the worked example is explicitly fictional.
- Restricted database draft visibility to administrators. Replaced script-only filtering with allowlisted DOM reconstruction and safe URL handling.
- Admin editor retains input on save failure and offers a sanitised preview.

## Verification
- Existing suite: 70 tests pass.
- Blog local test: public/member draft isolation, administrator visibility, 20 unique illustrated articles.
- Browser: search, pagination, pricing table/contents, safe markup handling, admin failed-save handling.
- Responsive iframe checks at 320, 375 and 768 pixels: document scroll width equals viewport client width after resolving legacy generic CSS overrides. Desktop checked at 1280 pixels.

## Operations
- RLS migration `20261011113216_blog_published_visibility.sql` applied using the Supabase migration connector.
- Content source: `content/blog-editorial.cjs`; rebuild JSON with `node tools/build-blog-content.cjs`.
- Emit content SQL with `node tools/build-blog-release-sql.cjs`. Rollout locks only the blog table, updates ten known posts and inserts missing slugs atomically; it is repeatable without duplicate new articles.
- Original database rows are backed up locally in ignored `.validation/blog-backup/original.json`; never publish draft backups.
- Pricing ranges are editorial planning examples, not measured market benchmarks. Sources are linked within the relevant guides.
- Other uncommitted payment/package/preference/report work is outside this release.
