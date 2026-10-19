"""Generate public-entry QR SVGs. Requires qrcode==8.2 (no image service)."""
from pathlib import Path
import json
import re
import qrcode
from qrcode.image.svg import SvgPathImage
root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'content/games-catalogue.json').read_text(encoding='utf-8'))
for entry in data['entries']:
    if not re.fullmatch(r'[a-z0-9-]+', entry['id']):
        raise ValueError('Invalid catalogue entry ID')
    url = 'https://sponsorsorter.com/games.html#' + entry['id']
    qr = qrcode.make(url, image_factory=SvgPathImage, border=4, box_size=10)
    qr.save(root / 'games-assets' / (entry['id'] + '-qr.svg'))
