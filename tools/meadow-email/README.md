# Separate application email designs

`branding.cjs` renders HTML and matching plain text with an explicit application:

- `meadow`: Meadow Markets farm artwork and game link.
- `sponsor`: Sponsor Sorter's existing round person logo (`logos.png`).
- `barge`: BargainBarge's existing barge mark, exported from its app SVG.

The delivery examples contain no login tokens. They are previews, not live Supabase authentication templates. Do not replace a shared project's templates with one application's branding. A production sender must select the application explicitly and supply its own verified action URL.

Game username/password accounts currently send no emails. Email recovery needs a separate verified-address flow before these templates can be used for recovery. Never email an internal game account alias.
