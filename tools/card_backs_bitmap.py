# Turns the dancing SVG card backs (tools/card-backs/back-N.svg, from
# card_backs.py) into high-definition animated WebP bitmaps for the extension
# (extension/card-backs/back-N.webp), with a photographic finish that would be
# too heavy to compute live: bloom round the lights, film grain and a vignette.
#
# Each frame is rendered by headless Chrome (the SVG frozen at that moment of its
# dance), finished with Pillow, and the frames saved as one looping WebP.
# Needs Google Chrome and Pillow (pip install pillow). Run from the repo root:
#   python tools/card_backs.py && python tools/card_backs_bitmap.py

import io, os, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "tools", "card-backs")
OUT = os.path.join(ROOT, "extension", "card-backs")
SIZE = (360, 440)   # twice the design's 180x220: crisp at the size cards show, on high-DPI screens too
FPS = 15
QUALITY = 82
CHROME = next((p for p in [
    os.environ.get("CHROME", ""),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    shutil.which("google-chrome") or "", shutil.which("chromium") or ""] if p and os.path.exists(p)), None)

# One page renders every frame: it freezes the SVG at each moment, copies it with
# the animated values written in as plain attributes (so the copy is a still
# picture), draws that onto a canvas and prints the PNGs for us to read back.
# Starting Chrome once per frame instead took minutes per design.
PAGE = """<!doctype html><html><body>{svg}<pre id="out"></pre>
<script>
(async () => {{
  const W = {w}, H = {h}, FRAMES = {frames}, DUR = {dur};
  const live = document.querySelector('svg');
  live.pauseAnimations();
  const out = [];
  for (let k = 0; k < FRAMES; k++) {{
    live.setCurrentTime(DUR * k / FRAMES);
    // Chrome applies the new time a moment later, not straight away (and headless
    // never runs requestAnimationFrame): wait briefly before reading it.
    await new Promise((r) => setTimeout(r, 30));
    const still = live.cloneNode(true);
    const a = [live, ...live.querySelectorAll('*')], b = [still, ...still.querySelectorAll('*')];
    a.forEach((el, i) => {{
      const kids = [...el.children].map((c) => c.tagName);
      if (kids.includes('animateTransform')) {{
        let m = null;
        for (const t of el.transform.animVal) m = m ? m.multiply(t.matrix) : t.matrix;
        if (m) b[i].setAttribute('transform', `matrix(${{m.a}},${{m.b}},${{m.c}},${{m.d}},${{m.e}},${{m.f}})`);
      }}
      if (kids.includes('animate')) b[i].setAttribute('opacity', getComputedStyle(el).opacity);
    }});
    still.querySelectorAll('animate, animateTransform').forEach((n) => n.remove());
    still.setAttribute('width', W); still.setAttribute('height', H);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(still));
    await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    out.push(c.toDataURL('image/png'));
  }}
  document.getElementById('out').textContent = out.join('\\n');
}})();
</script></body></html>"""

def render_frames(page, profile):
    """Every frame of the dance, as PNG bytes."""
    url = "file:///" + page.replace("\\", "/")
    dom = subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={profile}",
                          "--virtual-time-budget=120000", "--dump-dom", url],
                         capture_output=True, text=True, encoding="utf-8", check=True, timeout=300).stdout
    import base64
    return [base64.b64decode(u) for u in re.findall(r"data:image/png;base64,([A-Za-z0-9+/=]+)", dom)]

def finish(img, grain):
    """Bloom, grain and vignette, kept inside the card's own shape."""
    rgb, alpha = img.convert("RGB"), img.getchannel("A")
    # Bloom: the brightest parts, blurred wide and added back softly.
    bright = rgb.point(lambda v: max(0, v - 150) * 2)
    rgb = ImageChops.add(rgb, bright.filter(ImageFilter.GaussianBlur(9)), scale=2.2)
    # Vignette: a light darkening towards the corners (heavier swallowed her at table size).
    w, h = rgb.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((-w * 0.25, -h * 0.18, w * 1.25, h * 1.18), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w * 0.12))
    rgb = Image.composite(rgb, ImageChops.multiply(rgb, Image.new("RGB", (w, h), (205, 205, 205))), mask)
    # Film grain, the same pattern each frame so it reads as texture, not static.
    # The noise is centred on 128: above it lightens a pixel, below darkens it.
    # ImageChops clips at 0, so the two halves are applied separately.
    mid = Image.new("RGB", grain.size, (128, 128, 128))
    rgb = ImageChops.subtract(ImageChops.add(rgb, ImageChops.subtract(grain, mid)), ImageChops.subtract(mid, grain))
    # Only the picture inside the gold frame gets the finish; the cream border
    # stays clean (the design's inner panel is 5 units in from each edge).
    s = w / 180
    inside = Image.new("L", (w, h), 0)
    ImageDraw.Draw(inside).rounded_rectangle((5 * s, 5 * s, w - 5 * s, h - 5 * s), radius=8 * s, fill=255)
    rgb = Image.composite(rgb, img.convert("RGB"), inside)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out

def build(n):
    svg_path = os.path.join(SRC, f"back-{n}.svg")
    svg = open(svg_path, encoding="utf-8").read()
    dur = float(re.search(r'dur="([\d.]+)s"', svg).group(1))
    frames = max(1, round(dur * FPS))
    work = tempfile.mkdtemp(prefix=f"cardback{n}-")
    page = os.path.join(work, "frames.html")
    open(page, "w", encoding="utf-8").write(PAGE.format(w=SIZE[0], h=SIZE[1], frames=frames, dur=dur, svg=svg))
    pngs = render_frames(page, os.path.join(work, "profile"))
    if len(pngs) != frames:
        raise RuntimeError(f"back-{n}: Chrome returned {len(pngs)} of {frames} frames")
    grain = Image.effect_noise(SIZE, 5).convert("RGB")   # centred on 128, gentle
    imgs = [finish(Image.open(io.BytesIO(p)).convert("RGBA"), grain) for p in pngs]
    out = os.path.join(OUT, f"back-{n}.webp")
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=round(dur * 1000 / frames),
                 loop=0, quality=QUALITY, method=6)
    shutil.rmtree(work, ignore_errors=True)
    return f"back-{n}.webp: {frames} frames, {os.path.getsize(out) // 1024} KB"

if __name__ == "__main__":
    if not CHROME:
        sys.exit("Google Chrome not found: set CHROME to its path")
    os.makedirs(OUT, exist_ok=True)
    with ThreadPoolExecutor(5) as pool:   # one Chrome per design, all at once
        for line in pool.map(build, range(1, 6)):
            print(line, flush=True)
