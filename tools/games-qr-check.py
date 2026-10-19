"""Check committed QR SVGs against deterministic encodings of their stable URLs."""
from pathlib import Path
from io import BytesIO
import json
import qrcode
from qrcode.image.svg import SvgPathImage
root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'content/games-catalogue.json').read_text(encoding='utf-8'))
for entry in data['entries']:
    url = 'https://sponsorsorter.com/games.html#' + entry['id']
    expected = BytesIO()
    qrcode.make(url, image_factory=SvgPathImage, border=4, box_size=10).save(expected)
    actual = (root / 'games-assets' / (entry['id'] + '-qr.svg')).read_bytes()
    assert actual == expected.getvalue(), 'QR mismatch: ' + entry['id']
    print(json.dumps({'entry': entry['id'], 'url': url, 'svg_matches_encoding': True}))
