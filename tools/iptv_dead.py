# Ships the table video channels found dead on this computer to everyone: reads
# the "Check channels" results (streamHealth) from the extension's storage in
# Chrome and writes them into extension/iptv-dead.js, which the popup uses to
# hide those channels before anyone has checked them. Merges with what's there:
# a channel stays listed until a check here finds it working again. Menu lists
# whose every channel is dead are listed too, and the popup leaves them out.
#
# Run a "Check channels" in the popup first, then from the repo root:
#   python tools/iptv_dead.py
# (Chrome's storage for the extension lives under its id; pass another profile's
# "Local Extension Settings/<id>" folder as the argument if it isn't the default.)

import datetime, glob, json, os, re, shutil, struct, sys, tempfile, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "extension", "iptv-dead.js")
MENU = os.path.join(ROOT, "extension", "iptv.js")
EXT_ID = "nbonfcgjghifjaipcjhdhginglomcoib"
DEFAULT = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "User Data", "Default",
                       "Local Extension Settings", EXT_ID)


# --- Reading Chrome's storage: a LevelDB folder ------------------------------
# Recent writes are in the .log file; older ones get packed into .ldb tables,
# whose blocks are usually snappy-compressed. Every write carries a sequence
# number, and the highest one for a key is its current value.

def varint(b, j):
    r = s = 0
    while True:
        c = b[j]; j += 1
        r |= (c & 127) << s; s += 7
        if c < 128: return r, j


def unsnappy(b):
    """Snappy decompression (the format LevelDB compresses its blocks with)."""
    size, i = varint(b, 0)
    out = bytearray()
    while i < len(b):
        tag = b[i]; i += 1
        kind = tag & 3
        if kind == 0:   # literal
            n = tag >> 2
            if n >= 60:
                extra = n - 59
                n = int.from_bytes(b[i:i + extra], "little"); i += extra
            n += 1
            out += b[i:i + n]; i += n
            continue
        if kind == 1:
            n = ((tag >> 2) & 7) + 4
            off = ((tag >> 5) << 8) | b[i]; i += 1
        elif kind == 2:
            n = (tag >> 2) + 1
            off = int.from_bytes(b[i:i + 2], "little"); i += 2
        else:
            n = (tag >> 2) + 1
            off = int.from_bytes(b[i:i + 4], "little"); i += 4
        for _ in range(n):   # copies may overlap what they're writing
            out.append(out[-off])
    assert len(out) == size, "bad snappy block"
    return bytes(out)


def block_entries(data, handle):
    """The (key, value) pairs in one table block."""
    off, size = handle
    raw, kind = data[off:off + size], data[off + size]
    block = unsnappy(raw) if kind == 1 else raw
    restarts = struct.unpack_from("<I", block, len(block) - 4)[0]
    end = len(block) - 4 - 4 * restarts
    i, key = 0, b""
    while i < end:
        shared, i = varint(block, i)
        unshared, i = varint(block, i)
        vlen, i = varint(block, i)
        key = key[:shared] + block[i:i + unshared]; i += unshared
        yield key, block[i:i + vlen]; i += vlen


def table_records(path):
    """(key, sequence, value or None if deleted) for every entry in an .ldb table."""
    data = open(path, "rb").read()
    footer = data[-48:]
    _, j = varint(footer, 0); _, j = varint(footer, j)   # metaindex handle (not needed)
    io, j = varint(footer, j); isz, j = varint(footer, j)
    for _, h in block_entries(data, (io, isz)):
        bo, k = varint(h, 0); bs, k = varint(h, k)
        for ikey, value in block_entries(data, (bo, bs)):
            tag = struct.unpack_from("<Q", ikey, len(ikey) - 8)[0]
            yield ikey[:-8].decode("utf-8", "replace"), tag >> 8, value if tag & 255 == 1 else None


def log_records(path):
    """The same for the .log file of recent writes (32 KiB blocks of write batches)."""
    data = open(path, "rb").read()
    batches, buf, i, blk = [], b"", 0, 32768
    while i + 7 <= len(data):
        if blk - i % blk < 7:
            i += blk - i % blk
            continue
        _, n, kind = struct.unpack_from("<IHB", data, i)
        i += 7
        frag, i = data[i:i + n], i + n
        if kind == 1: batches.append(frag)
        elif kind == 2: buf = frag
        elif kind == 3: buf += frag
        elif kind == 4: batches.append(buf + frag); buf = b""
    for b in batches:
        try:
            seq, count = struct.unpack_from("<QI", b, 0)
            j = 12
            for n in range(count):
                kind = b[j]; j += 1
                kl, j = varint(b, j)
                key = b[j:j + kl].decode("utf-8", "replace"); j += kl
                value = None
                if kind == 1:
                    vl, j = varint(b, j)
                    value = b[j:j + vl]; j += vl
                yield key, seq + n, value
        except (struct.error, IndexError):
            pass   # a batch cut short by Chrome still writing


def latest_values(folder):
    work = tempfile.mkdtemp()
    newest = {}
    for path in glob.glob(os.path.join(folder, "*.ldb")) + glob.glob(os.path.join(folder, "*.log")):
        copy = os.path.join(work, os.path.basename(path))
        shutil.copyfile(path, copy)   # Chrome has them open
        records = log_records(copy) if path.endswith(".log") else table_records(copy)
        for key, seq, value in records:
            if key not in newest or seq > newest[key][0]:
                newest[key] = (seq, value)
    shutil.rmtree(work, ignore_errors=True)
    return {k: v.decode("utf-8") for k, (_, v) in newest.items() if v is not None}


# --- The popup's menu of lists ----------------------------------------------

def menu_lists():
    """[(id, label)] for each list in the popup's menu (IPTV_MENU in iptv.js)."""
    src = open(MENU, encoding="utf-8").read()
    repo = re.search(r'IPTV_REPO = "([^"]+)"', src).group(1)
    countries = dict(re.findall(r'(\w\w): "([^"]+)"', src[src.index("IPTV_COUNTRIES"):src.index("IPTV_MENU")]))
    menu = src[src.index("const IPTV_MENU"):src.index("IPTV_RENAMED")]
    lists = re.findall(r'\["(\w+)", "([^"]+)"\]', menu)
    country_file = re.search(r'\["(\w+):" \+ code', menu).group(1)
    lists += [(f"{country_file}:{code}", name) for code, name in countries.items()]
    return repo, lists


def channels(text):
    """[(country, url)] for a playlist's channels, as iptvParse in iptv.js reads them."""
    out, country = [], None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#EXTINF"):
            m = re.search(r'tvg-id="[^"]*\.([a-z]{2})(?:@[\w-]*)?"', line, re.I)
            country = m.group(1).lower() if m else ""
        elif line and not line.startswith("#"):
            if country is not None and re.match(r"https?://", line, re.I) and not re.search(r"\.mpd(\?|$)", line, re.I):
                out.append((country, line))
            country = None
    return out


def dead_lists(dead_urls):
    """Menu lists with channels, all of them dead."""
    repo, lists = menu_lists()
    files = {}
    found = []
    for list_id, label in lists:
        file, _, country = list_id.partition(":")
        if file not in files:
            with urllib.request.urlopen(repo + file + ".m3u8", timeout=60) as res:
                files[file] = channels(res.read().decode("utf-8", "replace"))
        urls = [u for c, u in files[file] if not country or c == country]
        if urls and all(u in dead_urls for u in urls):
            found.append((list_id, label))
    return found


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    values = latest_values(folder)
    if "streamHealth" not in values:
        sys.exit("No channel checks found: run Check channels in the popup first.")
    health = json.loads(values["streamHealth"])
    dead = {u for u, h in health.items() if not h["ok"]}
    working = {u for u, h in health.items() if h["ok"]}

    known = set()
    if os.path.exists(OUT):
        m = re.search(r"urls: (\[.*?\])", open(OUT, encoding="utf-8").read(), re.S)
        if m: known = set(json.loads(m.group(1)))
    urls = sorted((known | dead) - working)
    gone = dead_lists(set(urls))

    today = datetime.date.today().isoformat()
    body = ",\n    ".join(json.dumps(u) for u in urls)
    open(OUT, "w", encoding="utf-8", newline="\n").write(
        "// Table video channels found dead (off air, or not shown here), so the popup\n"
        "// hides them before you've checked them yourself, and the menu lists with no\n"
        "// working channels at all, which it leaves out. Made by tools/iptv_dead.py from\n"
        "// Check channels runs; your own checks, and channels you watch, overrule it.\n"
        f"const IPTV_KNOWN_DEAD = {{\n  checked: {json.dumps(today)},\n"
        f"  lists: {json.dumps([i for i, _ in gone])},\n"
        f"  urls: [\n    {body}\n  ]\n}};\n")
    print(f"{len(urls)} dead channels in {os.path.relpath(OUT, ROOT)} "
          f"({len(dead)} dead and {len(working)} working in the checks, {len(known)} listed before)")
    print("Lists with nothing working, left out of the menu:", ", ".join(l for _, l in gone) or "none")
    if "streamCheck" in values:
        c = json.loads(values["streamCheck"])
        if c["done"] < c["total"]:
            print(f"Note: the check of {c['list']} was at {c['done']} of {c['total']}")


if __name__ == "__main__":
    main()
