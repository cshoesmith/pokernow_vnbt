# Generates the five card back SVGs in extension/card-backs: backlit silhouettes
# of figures in lingerie, stockings and heels, each on its own coloured glow
# inside a frame. Run from the repo root after changing a pose or colour:
#   python tools/card_backs.py
import math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "extension", "card-backs")
W, H = 180, 220

def catmull(points, closed=True):
    """Smooth path through points (Catmull-Rom as cubic Beziers)."""
    n = len(points)
    pts = points
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if closed or i > 0 else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed or i + 2 < n else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d + (" Z" if closed else "")

def limb(a, b, wa, wb, bulge=0.15):
    """Tapered limb from a (width wa) to b (width wb), slightly muscled, round ends."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    wm = (wa + wb) / 2 * (1 + bulge)
    pts = [(a[0] + nx * wa / 2, a[1] + ny * wa / 2), (m[0] + nx * wm / 2, m[1] + ny * wm / 2),
           (b[0] + nx * wb / 2, b[1] + ny * wb / 2), (b[0] - nx * wb / 2, b[1] - ny * wb / 2),
           (m[0] - nx * wm / 2, m[1] - ny * wm / 2), (a[0] - nx * wa / 2, a[1] - ny * wa / 2)]
    d = (f"M{pts[0][0]:.1f},{pts[0][1]:.1f} Q{pts[1][0]*2-(pts[0][0]+pts[2][0])/2:.1f},{pts[1][1]*2-(pts[0][1]+pts[2][1])/2:.1f} {pts[2][0]:.1f},{pts[2][1]:.1f}"
         f" L{pts[3][0]:.1f},{pts[3][1]:.1f} Q{pts[4][0]*2-(pts[3][0]+pts[5][0])/2:.1f},{pts[4][1]*2-(pts[3][1]+pts[5][1])/2:.1f} {pts[5][0]:.1f},{pts[5][1]:.1f} Z")
    return (f'<path d="{d}"/><circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="{wa/2:.1f}"/>'
            f'<circle cx="{b[0]:.1f}" cy="{b[1]:.1f}" r="{wb/2:.1f}"/>')

def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

def across(a, b, t, w):
    """A short segment across the limb a->b at t, width w (for stocking tops)."""
    p = lerp(a, b, t)
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * w / 2, dx / L * w / 2
    return (p[0] - nx, p[1] - ny), (p[0] + nx, p[1] + ny)

def figure(P):
    """Silhouette shapes (filled by the caller) and lingerie detail lines."""
    s = []
    # Hair behind the head, then head and neck.
    s.append(f'<path d="{catmull(P["hair"])}"/>')
    hx, hy = P["head"]
    s.append(f'<ellipse cx="{hx}" cy="{hy}" rx="8" ry="10" transform="rotate({P.get("tilt",0)} {hx} {hy})"/>')
    s.append(limb(P["neck"][0], P["neck"][1], 7, 8, 0))
    s.append(f'<path d="{catmull(P["torso"])}"/>')
    for arm in P["arms"]:
        sh, el, ha = arm
        s.append(limb(sh, el, 7.5, 5.5))
        s.append(limb(el, ha, 5.5, 3.8))
        s.append(f'<circle cx="{ha[0]}" cy="{ha[1]}" r="3.2"/>')
    for leg in P["legs"]:
        hp, kn, an, toe = leg
        s.append(limb(hp, kn, 16, 9.5, 0.12))
        s.append(limb(kn, an, 9.5, 4.6, 0.22))
        s.append(limb(an, toe, 4.6, 2.2, 0))
        # Stiletto heel: from the ankle's back, down to the floor line under it.
        if leg_heel := P.get("heels", True):
            back = (an[0] - (toe[0] - an[0]) * 0.25, an[1] - (toe[1] - an[1]) * 0.25)
            floor = (back[0], back[1] + 9 * (1 if toe[1] >= an[1] else -1)) if abs(toe[0]-an[0]) < abs(toe[1]-an[1]) else (back[0], back[1] + 9)
            s.append(f'<path d="M{back[0]-1.6:.1f},{back[1]:.1f} L{floor[0]:.1f},{floor[1]:.1f} L{back[0]+1.6:.1f},{back[1]:.1f} Z"/>')
    shapes = "".join(s)
    d = []
    # Bra: a line under the bust and two cup curves; straps up to the shoulders.
    for cup in P["bra"]:
        d.append(f'<path d="{catmull(cup, closed=False)}"/>')
    # Briefs: the waistband and leg openings.
    for line in P["briefs"]:
        d.append(f'<path d="{catmull(line, closed=False)}"/>')
    # Stocking tops with a lace band, and garters from the briefs.
    for leg, garter in zip(P["legs"], P.get("garters", [None, None])):
        hp, kn, an, toe = leg
        a, b = across(hp, kn, 0.62, 16.5)
        a2, b2 = across(hp, kn, 0.67, 15.5)
        d.append(f'<path d="M{a[0]:.1f},{a[1]:.1f} L{b[0]:.1f},{b[1]:.1f}"/>')
        d.append(f'<path class="lace" d="M{a2[0]:.1f},{a2[1]:.1f} L{b2[0]:.1f},{b2[1]:.1f}"/>')
        if garter:
            m = lerp(a, b, 0.5)
            d.append(f'<path d="M{garter[0]:.1f},{garter[1]:.1f} L{m[0]:.1f},{m[1]:.1f}"/>')
        # Stocking seam up the back of the calf.
        k2, a3 = lerp(kn, an, 0.05), lerp(kn, an, 0.95)
        d.append(f'<path class="seam" d="M{k2[0]:.1f},{k2[1]:.1f} L{a3[0]:.1f},{a3[1]:.1f}"/>')
    return shapes, "".join(d)

# ---------- Poses (card units, y down) ----------

STANDING = {   # contrapposto, one hand on the hip, the other lifting the hair
    "head": (92, 38), "tilt": -12,
    "hair": [(84, 30), (92, 25), (101, 30), (104, 42), (101, 56), (96, 50), (88, 46)],
    "neck": [(91, 46), (90, 56)],
    "torso": [(78, 58), (90, 55), (103, 58), (107, 66), (107, 76), (101, 84), (98, 94), (103, 106),
              (106, 116), (97, 124), (90, 126), (82, 124), (73, 116), (75, 104), (82, 94), (79, 84), (73, 76), (73, 66)],
    "arms": [((104, 60), (116, 40), (100, 30)), ((77, 61), (63, 84), (77, 104))],
    "legs": [((82, 118), (85, 158), (88, 192), (90, 204)), ((99, 116), (96, 156), (100, 191), (104, 203))],
    "bra": [[(74, 72), (81, 79), (89, 77), (90, 71)], [(90, 71), (95, 78), (102, 80), (107, 72)],
            [(80, 79), (90, 82), (101, 81)], [(81, 72), (79, 62)], [(101, 72), (102, 61)]],
    "briefs": [[(75, 107), (83, 112), (90, 120), (97, 112), (105, 106)], [(75, 112), (90, 125), (105, 112)]],
    "garters": [(79, 112), (101, 111)],
}

SEATED = {   # perched on a stool, legs crossed, leaning back on one hand
    "head": (82, 40), "tilt": 14,
    "hair": [(74, 34), (80, 27), (90, 29), (94, 40), (90, 52), (82, 62), (78, 52)],
    "neck": [(83, 49), (85, 58)],
    "torso": [(73, 62), (85, 57), (98, 61), (100, 70), (98, 80), (95, 88), (98, 100), (104, 112), (100, 122),
              (86, 124), (74, 118), (76, 104), (79, 92), (75, 82), (70, 72)],
    "arms": [((98, 62), (112, 80), (114, 104)), ((74, 63), (66, 46), (78, 32))],
    "legs": [((94, 116), (128, 120), (118, 160), (124, 172)), ((86, 118), (122, 128), (102, 164), (104, 177))],
    "bra": [[(71, 74), (78, 82), (85, 80), (86, 73)], [(86, 73), (91, 80), (98, 80), (100, 72)],
            [(77, 82), (87, 84), (97, 82)], [(77, 74), (75, 64)], [(96, 73), (96, 63)]],
    "briefs": [[(77, 104), (87, 109), (100, 105)], [(78, 110), (90, 118), (101, 110)]],
    "garters": [(96, 112), None],
}

ARMS_UP = {   # both hands behind the head, hips swaying the other way
    "head": (90, 40), "tilt": 6,
    "hair": [(81, 33), (89, 26), (99, 31), (102, 44), (98, 58), (90, 50), (82, 48)],
    "neck": [(90, 48), (90, 57)],
    "torso": [(77, 59), (90, 56), (103, 59), (107, 68), (106, 77), (100, 85), (97, 95), (100, 106),
              (104, 116), (95, 125), (88, 127), (80, 124), (72, 114), (74, 103), (80, 94), (78, 85), (73, 77), (73, 67)],
    "arms": [((103, 60), (118, 38), (96, 30)), ((77, 60), (62, 38), (84, 30))],
    "legs": [((81, 117), (80, 157), (84, 193), (86, 205)), ((98, 116), (102, 155), (94, 191), (96, 203))],
    "bra": [[(74, 73), (81, 80), (89, 78), (90, 72)], [(90, 72), (95, 79), (102, 80), (106, 73)],
            [(80, 80), (90, 83), (101, 81)], [(80, 73), (79, 62)], [(100, 73), (101, 62)]],
    "briefs": [[(74, 106), (82, 111), (89, 119), (96, 111), (102, 106)], [(74, 111), (89, 125), (103, 111)]],
    "garters": [(78, 112), (99, 111)],
}



BACK_VIEW = {   # seen from behind, hands on hips, one heel lifted
    "head": (90, 36), "tilt": -8,
    "hair": [(80, 30), (89, 23), (100, 29), (102, 44), (100, 62), (90, 66), (80, 62), (78, 44)],
    "neck": [(90, 44), (90, 55)],
    "torso": [(76, 58), (90, 55), (104, 58), (107, 68), (104, 80), (99, 92), (102, 104),
              (107, 116), (100, 127), (90, 128), (80, 127), (73, 116), (78, 104), (81, 92), (76, 80), (73, 68)],
    "arms": [((104, 60), (118, 82), (101, 98)), ((76, 60), (62, 82), (79, 98))],
    "legs": [((82, 120), (83, 160), (86, 194), (86, 205)), ((98, 120), (104, 156), (98, 186), (104, 194))],
    # Back view: the bra's back band and straps, no cups.
    "bra": [[(75, 76), (90, 78), (105, 76)], [(75, 71), (90, 73), (105, 71)], [(81, 71), (80, 60)], [(99, 71), (100, 60)]],
    "briefs": [[(75, 106), (90, 108), (105, 106)], [(74, 116), (82, 124), (90, 118), (98, 124), (106, 116)]],
    "garters": [(80, 112), (100, 112)],
}

def card(i, name, pose, glow, glow2, rim, frame, extra_bg="", extra_fg="", flip=None):
    shapes, details = figure(pose)
    fig_t = ""
    body = f'<g fill="#0a0a0e">{shapes}</g>'
    glow_body = f'<g fill="{rim}" filter="url(#rim{i})">{shapes}</g>'
    det = f'<g fill="none" stroke="{rim}" stroke-width="0.9" stroke-linecap="round" opacity="0.75">{details}</g>'
    figure_svg = glow_body + body + det
    if flip:   # a court-card style mirror: the figure twice, head to toe
        figure_svg = (f'<g clip-path="url(#top{i})">{figure_svg}</g>'
                      f'<g clip-path="url(#top{i})" transform="rotate(180 {W/2} {H/2})">{figure_svg}</g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
  <title>{name}</title>
  <defs>
    <radialGradient id="bg{i}" cx="50%" cy="48%" r="62%">
      <stop offset="0" stop-color="{glow}"/><stop offset=".55" stop-color="{glow2}"/><stop offset="1" stop-color="#050507"/>
    </radialGradient>
    <filter id="rim{i}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <clipPath id="card{i}"><rect x="7" y="7" width="{W-14}" height="{H-14}" rx="8"/></clipPath>
    <clipPath id="top{i}"><rect x="0" y="0" width="{W}" height="{H/2}"/></clipPath>
    <style>.lace {{ stroke-dasharray: 1 1.4; stroke-width: 2.2; }} .seam {{ stroke-width: .5; opacity: .7; }}</style>
  </defs>
  <rect width="{W}" height="{H}" rx="12" fill="#f4efe4"/>
  <rect x="4" y="4" width="{W-8}" height="{H-8}" rx="10" fill="#08080b"/>
  <g clip-path="url(#card{i})">
    <rect width="{W}" height="{H}" fill="url(#bg{i})"/>
    {extra_bg}
    {figure_svg}
    {extra_fg}
  </g>
  <rect x="7" y="7" width="{W-14}" height="{H-14}" rx="8" fill="none" stroke="{frame}" stroke-width="1.6"/>
  <rect x="11" y="11" width="{W-22}" height="{H-22}" rx="6" fill="none" stroke="{frame}" stroke-width=".6" opacity=".7"/>
  {''.join(f'<path d="M{x},{y-5} L{x+5},{y} L{x},{y+5} L{x-5},{y} Z" fill="{frame}"/>' for x, y in [(18, 18), (W-18, 18), (18, H-18), (W-18, H-18)])}
</svg>'''

def blinds():
    return "".join(f'<rect x="0" y="{y}" width="{W}" height="5" fill="#000" opacity=".45" transform="rotate(-12 90 110)"/>'
                   for y in range(-40, 260, 11))

def smoke(color):
    return "".join(f'<path d="M{x},{H} C{x-20},{150} {x+30},{110} {x},{60} S{x-10},{10} {x+15},-10" fill="none" '
                   f'stroke="{color}" stroke-width="{w}" opacity="{o}" stroke-linecap="round"/>'
                   for x, w, o in [(30, 10, .10), (60, 6, .08), (150, 12, .10), (125, 5, .07)])

def stool():
    return ('<path d="M74,124 L112,124 L110,130 L76,130 Z" fill="#050508"/>'
            '<path d="M82,130 L74,206 M104,130 L112,206 M78,170 L108,170" stroke="#050508" stroke-width="3" stroke-linecap="round"/>')

def spotlight(color):
    return f'<path d="M70,-5 L110,-5 L150,{H} L30,{H} Z" fill="{color}" opacity=".10"/>'

cards = [
    ("Scarlet", STANDING, "#ff3b4e", "#7a0d1e", "#ff8a8a", "#d4a64a", spotlight("#ffd0d0"), ""),
    ("Velvet", SEATED, "#b05cff", "#3b0f63", "#e3b6ff", "#c9a96e", stool(), ""),
    ("Blinds", ARMS_UP, "#ffb347", "#7a3f06", "#ffd59a", "#e0b25a", "", blinds()),
    ("Jade", BACK_VIEW, "#2ee6b5", "#0b4d4a", "#a6ffe6", "#cdb27a", smoke("#bfffee"), ""),
]
os.makedirs(OUT, exist_ok=True)
for i, (name, pose, g1, g2, rim, frame, bg, fg) in enumerate(cards, 1):
    open(f"{OUT}/back-{i}.svg", "w", encoding="utf-8").write(card(i, name, pose, g1, g2, rim, frame, bg, fg))
# Gold: the arms-up figure from the waist up, mirrored head to toe like a court card.
open(f"{OUT}/back-5.svg", "w", encoding="utf-8").write(
    card(5, "Gold", ARMS_UP, "#ffd36b", "#6b4a0a", "#fff0b8", "#e9c46a",
         "", f'<path d="M7,{H/2} H{W-7}" stroke="#e9c46a" stroke-width="1.2"/>', flip=True))
print("ok")
