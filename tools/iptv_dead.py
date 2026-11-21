# Ships the table video channels found dead on this computer to everyone: reads
# the "Check channels" results (streamHealth) from the extension's storage in
# Chrome and writes them into extension/iptv-dead.js, which the popup uses to
# hide those channels before anyone has checked them. Merges with what's there:
# a channel stays listed until a check here finds it working again. The rest of
# the file (blocked services, lists with nothing working) is tools/iptv_check.mjs's,
# which tests every channel itself; this adds what the popup's checks found.
#
# Run a "Check channels" in the popup first, then from the repo root:
#   python tools/iptv_dead.py
# (Chrome's storage for the extension lives under its id; pass another profile's
# "Local Extension Settings/<id>" folder as the argument if it isn't the default.)

import datetime, glob, json, os, re, shutil, struct, sys, tempfile, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "extension", "iptv-dead.js")
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


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    values = latest_values(folder)
    if "streamHealth" not in values:
        sys.exit("No channel checks found: run Check channels in the popup first.")
    health = json.loads(values["streamHealth"])
    dead = {u for u, h in health.items() if not h["ok"]}
    working = {u for u, h in health.items() if h["ok"]}

    # The rest of the file (blocked services, lists with nothing working) comes
    # from tools/iptv_check.mjs and is kept as it is; only the channels change.
    src = open(OUT, encoding="utf-8").read()
    m = re.search(r"  urls: (\[.*?\])\n", src, re.S)
    known = set(json.loads(m.group(1)))
    blocked_hosts = json.loads(re.search(r"blockedHosts: (\[.*?\])", src).group(1))

    def blocked(url):
        host = urllib.parse.urlsplit(url).hostname or ""
        return any(host == b or host.endswith("." + b) for b in blocked_hosts)

    urls = sorted(u for u in (known | dead) - working if not blocked(u))   # blocked ones go by host
    body = ",\n    ".join(json.dumps(u) for u in urls)
    src = src[:m.start(1)] + f"[\n    {body}\n  ]" + src[m.end(1):]
    src = re.sub(r'checked: "[^"]*"', f'checked: {json.dumps(datetime.date.today().isoformat())}', src)
    open(OUT, "w", encoding="utf-8", newline="\n").write(src)
    print(f"{len(urls)} dead channels in {os.path.relpath(OUT, ROOT)} "
          f"({len(dead)} dead and {len(working)} working in the checks, {len(known)} listed before)")
    if "streamCheck" in values:
        c = json.loads(values["streamCheck"])
        if c["done"] < c["total"]:
            print(f"Note: the check of {c['list']} was at {c['done']} of {c['total']}")


if __name__ == "__main__":
    main()
