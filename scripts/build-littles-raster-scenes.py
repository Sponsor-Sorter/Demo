"""Build clean image/mask/preview assets from the generated Littles line art."""
import json
from array import array
from pathlib import Path
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / "meadow-market-littles/assets/generated/art-simple"
SIZE = 512
PALETTE = [[117,68,40],[246,209,154],[255,213,177],[87,130,65],[155,191,90],
           [232,84,72],[243,148,57],[250,210,78],[137,197,231],[238,238,224],
           [154,168,177],[66,86,108],[255,255,255]]
NAMES = ["Brown","Straw","Skin","Leaf green","Meadow green","Red","Orange",
         "Sunflower yellow","Sky blue","Cream","Silver","Slate","White"]
SCENES = [
    ("11-jade-pumpkin-patch", "Jade waters the pumpkin patch", "jade"),
    ("12-alpaca-flower-crown", "Alpaca’s flower crown", "alpaca"),
    ("13-little-farm-windmill", "The little farm windmill", "windmill"),
    ("14-apple-market-cart", "Apples for market day", "apples"),
    ("15-duck-pond-friends", "Duck family at the pond", "ducks"),
    ("16-hen-chick-egg", "Hen and chick find an egg", "hen"),
    ("17-lamb-and-daisy", "Little lamb and daisy", "lamb"),
    ("18-tractor-hay-bale", "Tractor brings the hay", "tractor"),
    ("19-rhys-pony-carrot", "Rhys shares a carrot with a pony", "pony"),
    ("20-sunflower-and-bee", "Bee visits the sunflower", "bee"),
]

def colour_for(kind, x, y):
    if kind == "jade":
        if y < 90: return 8
        if x > 350 and y < 280: return 5
        if x > 210 and y > 335: return 3 if x < 300 else 6
        if x < 200 and y < 170: return 1 if y < 85 else 0
        if x < 220 and y < 270: return 2 if y < 235 else 3
        return 4 if y > 370 else 3
    if kind == "alpaca":
        if x > 340 and 130 < y < 340: return 7
        if y > 390: return 4
        if x < 340 and y < 300: return 9 if y > 160 else 2
        return 3 if y > 300 else 8
    if kind == "windmill":
        if x > 350 and y < 170: return 7
        if y > 430: return 4
        if 170 < x < 365 and 190 < y < 430: return 9
        return 5 if y < 330 else 3
    if kind == "apples":
        if y < 130: return 8
        if x > 245 and y > 300: return 0 if y > 370 else 5
        if x < 310 and y < 330: return 3 if y < 190 else 5
        return 4 if y > 380 else 1
    if kind == "ducks":
        if y > 400: return 8
        if y < 130: return 7
        return 7 if x < 270 or y < 300 else 8
    if kind == "hen":
        if x > 340: return 7
        if y > 385: return 1
        return 9 if x < 300 else 6
    if kind == "lamb":
        if x > 310 and 200 < y < 430: return 7
        if y > 420: return 4
        return 9 if y < 390 else 1
    if kind == "tractor":
        if x > 300 and y < 400: return 7
        if y > 440: return 4
        if x < 300 and y < 390: return 5
        if x < 300 and y > 390: return 11
        return 8
    if kind == "pony":
        if x > 270: return 0 if y < 360 else 1
        if x < 260 and y < 240: return 1
        if x < 260 and y > 300: return 3
        return 6 if 180 < x < 330 else 8
    if kind == "bee":
        if x > 330 and y < 290: return 7
        if y > 330: return 3
        if x < 100 and y < 170: return 8
        return 7
    return 9

def build(scene_id, title, kind):
    source_png = ROOT / f"{scene_id}-source.png"
    source_webp = ROOT / f"{scene_id}-source.webp"
    source = Image.open(source_png if source_png.exists() else source_webp).convert("L")
    source.save(source_png, optimize=True)
    line = source.resize((1024,1024), Image.Resampling.LANCZOS)
    line.save(ROOT / f"{scene_id}-line.webp", "WEBP", lossless=True, method=6)
    gray_image = source.resize((SIZE,SIZE), Image.Resampling.LANCZOS).convert("L")
    # Close tiny antialiased gaps before tracing white fillable areas.
    closed = gray_image.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    pixels = list(closed.getdata())
    labels = array('I', [0]) * (SIZE * SIZE)
    components = []
    component_id = 0
    for start, value in enumerate(pixels):
        if value < 210 or labels[start]:
            continue
        component_id += 1
        labels[start] = component_id
        stack = [start]
        count = sx = sy = 0
        while stack:
            at = stack.pop()
            x, y = at % SIZE, at // SIZE
            count += 1; sx += x; sy += y
            for nxt in (at - 1 if x else -1, at + 1 if x < SIZE-1 else -1,
                        at - SIZE if y else -1, at + SIZE if y < SIZE-1 else -1):
                if nxt >= 0 and not labels[nxt] and pixels[nxt] >= 210:
                    labels[nxt] = component_id
                    stack.append(nxt)
        components.append((component_id, count, sx, sy))
    outside = labels[0]
    candidates = [c for c in components if c[0] != outside and c[1] >= 350]
    candidates.sort(key=lambda c: c[1], reverse=True)
    candidates = candidates[:64]
    mapping = np.zeros(component_id + 1, dtype=np.uint16)
    regions = []
    for new_id, (old_id, area, sx, sy) in enumerate(candidates, 1):
        mapping[old_id] = new_id
        x, y = round(sx / area), round(sy / area)
        regions.append({"id":new_id,"x":x,"y":y,"radius":1,
                        "paint":colour_for(kind,x,y),"area":area})
    label_array = np.frombuffer(labels, dtype=np.uint32).reshape(SIZE,SIZE)
    mask_ids = mapping[label_array]
    encoded = np.zeros((SIZE,SIZE,3), dtype=np.uint8)
    encoded[:,:,0] = mask_ids & 255
    encoded[:,:,1] = mask_ids >> 8
    Image.fromarray(encoded, "RGB").save(ROOT / f"{scene_id}-mask.png", optimize=True)
    preview = np.empty((SIZE,SIZE,3), dtype=np.uint8)
    preview[:] = [255,253,247]
    for region in regions:
        preview[mask_ids == region["id"]] = PALETTE[region["paint"]]
    # Restore crisp ink over the gentle colour preview.
    ink_alpha = (255 - np.array(gray_image, dtype=np.uint8).astype(np.float32)) / 255.0
    preview = (preview.astype(np.float32) * (1-ink_alpha[:,:,None])).astype(np.uint8)
    preview_image = Image.fromarray(preview, "RGB")
    preview_image.save(ROOT / f"{scene_id}-preview.webp", "WEBP", quality=88, method=6)
    preview_image.resize((256,256),Image.Resampling.LANCZOS).save(ROOT / f"{scene_id}-thumb.webp", "WEBP", quality=82, method=6)
    data = {"id":scene_id,"title":title,"size":SIZE,"revision":1,"packedMask":True,
            "regions":regions,"palette":PALETTE,"paletteNames":NAMES}
    (ROOT / f"{scene_id}.json").write_text(json.dumps(data,separators=(",",":")),encoding="utf-8")
    max_other = max((area for cid,area,_,_ in components if cid != outside), default=0)
    print(f"{scene_id}: {len(regions)} regions, largest non-background component {max_other}")

for scene in SCENES:
    build(*scene)
