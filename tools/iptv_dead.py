# Ships the table video channels found dead on this computer to everyone: reads
# the "Check channels" results (streamHealth) from the extension's storage in
# Chrome and writes them into extension/iptv-dead.js, which the popup uses to
# hide those channels before anyone has checked them. Merges with what's there:
# a channel stays listed until a check here finds it working again.
#
# Run a "Check channels" in the popup first, then from the repo root:
#   python tools/iptv_dead.py
# (Chrome's storage for the extension lives under its id; pass another profile's
# "Local Extension Settings/<id>" folder as the argument if it isn't the default.)

import datetime, glob, json, os, re, shutil, struct, sys, tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "extension", "iptv-dead.js")
EXT_ID = "nbonfcgjghifjaipcjhdhginglomcoib"
DEFAULT = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "User Data", "Default",
                       "Local Extension Settings", EXT_ID)


def latest_values(folder):
    """The newest value of each key in the storage's write log. Chrome rewrites
    streamHealth whole on every change, and LevelDB always puts the newest write
    in the current .log file, so that's the only file needed."""
    log = max(glob.glob(os.path.join(folder, "*.log")), key=os.path.getmtime)
    tmp = os.path.join(tempfile.mkdtemp(), "log")
    shutil.copyfile(log, tmp)   # Chrome has it open
    data = open(tmp, "rb").read()
    # Records in 32 KiB blocks (checksum, length, type), joined into write batches.
    batches, buf, i, block = [], b"", 0, 32768
    while i + 7 <= len(data):
        if block - i % block < 7:
            i += block - i % block
            continue
        _, n, kind = struct.unpack_from("<IHB", data, i)
        i += 7
        frag, i = data[i:i + n], i + n
        if kind == 1: batches.append(frag)
        elif kind == 2: buf = frag
        elif kind == 3: buf += frag
        elif kind == 4: batches.append(buf + frag); buf = b""

    def varint(b, j):
        r = s = 0
        while True:
            c = b[j]; j += 1
            r |= (c & 127) << s; s += 7
            if c < 128: return r, j

    values = {}
    for b in batches:
        j = 12
        try:
            for _ in range(struct.unpack_from("<I", b, 8)[0]):
                kind = b[j]; j += 1
                kl, j = varint(b, j)
                key = b[j:j + kl].decode(); j += kl
                if kind == 1:
                    vl, j = varint(b, j)
                    values[key] = b[j:j + vl].decode(); j += vl
                else:
                    values.pop(key, None)
        except Exception:
            pass   # a batch cut short by Chrome still writing
    return values


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
        m = re.search(r"urls: (\[.*\])", open(OUT, encoding="utf-8").read(), re.S)
        if m: known = set(json.loads(m.group(1)))
    urls = sorted((known | dead) - working)

    today = datetime.date.today().isoformat()
    body = ",\n    ".join(json.dumps(u) for u in urls)
    open(OUT, "w", encoding="utf-8", newline="\n").write(
        "// Table video channels found dead (off air, or not shown here), so the popup\n"
        "// hides them before you've checked them yourself. Made by tools/iptv_dead.py\n"
        "// from a Check channels run; your own checks, and channels you watch, overrule it.\n"
        f"const IPTV_KNOWN_DEAD = {{\n  checked: {json.dumps(today)},\n  urls: [\n    {body}\n  ]\n}};\n")
    print(f"{len(urls)} dead channels in {os.path.relpath(OUT, ROOT)} "
          f"({len(dead)} dead and {len(working)} working in this check, {len(known)} listed before)")
    if "streamCheck" in values:
        c = json.loads(values["streamCheck"])
        if c["done"] < c["total"]:
            print(f"Note: the check of {c['list']} was at {c['done']} of {c['total']}")


if __name__ == "__main__":
    main()
