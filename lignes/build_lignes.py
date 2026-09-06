# -*- coding: utf-8 -*-
"""
Construit lignes/lignes_kb.js à partir du GTFS national luxembourgeois.

Usage :
    python build_data.py                  télécharge le GTFS courant sur data.public.lu
    python build_data.py chemin/gtfs.zip  utilise un zip déjà téléchargé
    python build_data.py --date 2026-09-08  jour de référence (défaut : prochain mardi)

Sortie : lignes_kb.js, un objet window.LIGNES avec
    stops     : id -> [nom, lat, lon, au Luxembourg 1/0]
    routes    : ligne -> [type, couleur, libellé long]
    patterns  : liste de [ligne, direction, terminus, [arrêts], [temps cumulés en s], [départs du 1er arrêt en s],
                          tracé encodé (Google polyline, 5 décimales), [index du point de tracé de chaque arrêt]]
    meta      : jour de référence, fichier source, date de construction

Le drapeau Luxembourg vient du polygone national `lu_polygon.json` (Nominatim, OpenStreetMap).
Le tracé vient de shapes.txt, simplifié par Douglas-Peucker à 20 m en conservant le point le plus proche de chaque arrêt.

Un pattern est une séquence d'arrêts distincte d'une ligne. Les temps cumulés sont la médiane
sur toutes les courses du jour de référence. Les départs permettent de compter les fréquences.
"""
import csv, io, json, os, sys, zipfile, datetime, collections, statistics, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://data.public.lu/api/1/datasets/horaires-et-arrets-des-transport-publics-gtfs/"


def latest_gtfs_url():
    d = json.load(urllib.request.urlopen(API))
    rs = [r for r in d["resources"] if r.get("format") == "zip"]
    rs.sort(key=lambda r: r["last_modified"], reverse=True)
    return rs[0]["url"], rs[0]["title"]


def next_tuesday(today=None):
    today = today or datetime.date.today()
    d = today + datetime.timedelta(days=(1 - today.weekday()) % 7 or 7)
    return d


def sec(s):
    h, m, x = s.split(":")
    return int(h) * 3600 + int(m) * 60 + int(x)


def point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat):
            x = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if x > lon:
                inside = not inside
    return inside


def dp_simplify(pts, tol, keep):
    """Douglas-Peucker sur une liste de (lat, lon), en degrés. keep : indices à conserver."""
    import math
    def dist(p, a, b):
        ax, ay, bx, by, px, py = a[1], a[0], b[1], b[0], p[1], p[0]
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    out = set(keep) | {0, len(pts) - 1}
    stack = [(0, len(pts) - 1)]
    anchors = sorted(out)
    stack = [(anchors[k], anchors[k + 1]) for k in range(len(anchors) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        dm, im = -1, -1
        for i in range(a + 1, b):
            d = dist(pts[i], pts[a], pts[b])
            if d > dm:
                dm, im = d, i
        if dm > tol:
            out.add(im)
            stack.append((a, im))
            stack.append((im, b))
    return sorted(out)


def encode_polyline(pts):
    out = []
    plat = plon = 0
    for lat, lon in pts:
        for v, pv in ((lat, plat), (lon, plon)):
            d = int(round(v * 1e5)) - int(round(pv * 1e5))
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20:
                out.append(chr((0x20 | (d & 0x1f)) + 63))
                d >>= 5
            out.append(chr(d + 63))
        plat, plon = lat, lon
    return "".join(out)


def main():
    args = sys.argv[1:]
    ref = None
    if "--date" in args:
        i = args.index("--date")
        ref = datetime.date.fromisoformat(args[i + 1])
        del args[i:i + 2]
    ref = ref or next_tuesday()
    dow = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][ref.weekday()]
    ds = ref.strftime("%Y%m%d")

    if args:
        zpath, title = args[0], os.path.basename(args[0])
    else:
        url, title = latest_gtfs_url()
        zpath = os.path.join(HERE, "data", title)
        os.makedirs(os.path.dirname(zpath), exist_ok=True)
        if not os.path.exists(zpath):
            print("téléchargement", url)
            urllib.request.urlretrieve(url, zpath)
    print("GTFS :", zpath, "| jour de référence :", ref, dow)

    z = zipfile.ZipFile(zpath)

    def rd(name):
        return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig"))

    ring = json.load(open(os.path.join(HERE, "lu_polygon.json")))
    stops = {}
    for s in rd("stops.txt"):
        try:
            la, lo = float(s["stop_lat"]), float(s["stop_lon"])
        except ValueError:
            continue
        stops[s["stop_id"]] = [s["stop_name"], round(la, 6), round(lo, 6), 1 if point_in_ring(lo, la, ring) else 0]

    active = set()
    for c in rd("calendar.txt"):
        if c[dow] == "1" and c["start_date"] <= ds <= c["end_date"]:
            active.add(c["service_id"])
    for e in rd("calendar_dates.txt"):
        if e["date"] == ds:
            if e["exception_type"] == "1":
                active.add(e["service_id"])
            else:
                active.discard(e["service_id"])

    routes = {}
    rid2short = {}
    for r in rd("routes.txt"):
        short = r["route_short_name"] or r["route_long_name"]
        rid2short[r["route_id"]] = short
        routes.setdefault(short, [int(r["route_type"]), r.get("route_color", ""), r.get("route_long_name", "")])

    trips = {}
    for t in rd("trips.txt"):
        if t["service_id"] in active:
            trips[t["trip_id"]] = (rid2short[t["route_id"]], t.get("direction_id", "0"), t.get("trip_headsign", ""), t.get("shape_id", ""))

    seq = collections.defaultdict(list)
    for r in rd("stop_times.txt"):
        tid = r["trip_id"]
        if tid in trips:
            seq[tid].append((int(r["stop_sequence"]), r["stop_id"], sec(r["departure_time"]), sec(r["arrival_time"])))
    for tid in seq:
        seq[tid].sort()

    # regroupement par pattern (ligne + séquence d'arrêts)
    pat = collections.defaultdict(list)
    for tid, st in seq.items():
        short, d, head, shp = trips[tid]
        key = (short, tuple(x[1] for x in st))
        pat[key].append((d, head, st, shp))

    # shapes : ne charger que celles utilisées
    need = {}
    for (short, sids), courses in pat.items():
        shp = collections.Counter(c[3] for c in courses if c[3]).most_common(1)
        need[(short, sids)] = shp[0][0] if shp else ""
    wanted = set(need.values())
    shapes = collections.defaultdict(list)
    for r in rd("shapes.txt"):
        if r["shape_id"] in wanted:
            shapes[r["shape_id"]].append((int(r["shape_pt_sequence"]), float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))
    for k in shapes:
        shapes[k].sort()
        shapes[k] = [(p[1], p[2]) for p in shapes[k]]
    print("shapes chargées :", len(shapes))

    import math
    def nearest_idx(pts, la, lo, start=0):
        best, bi = 1e18, start
        for i in range(start, len(pts)):
            d = (pts[i][0] - la) ** 2 + ((pts[i][1] - lo) * math.cos(math.radians(la))) ** 2
            if d < best:
                best, bi = d, i
        return bi

    patterns = []
    used = set()
    TOL = 20 / 111000.0  # 20 m en degrés
    for (short, sids), courses in pat.items():
        n = len(sids)
        cum = []
        for i in range(n):
            vals = [st[i][3] - st[0][2] for _, _, st, _ in courses]
            cum.append(int(statistics.median(vals)))
        deps = sorted(st[0][2] for _, _, st, _ in courses)
        heads = collections.Counter(h for _, h, _, _ in courses)
        head = heads.most_common(1)[0][0]
        d = collections.Counter(dd for dd, _, _, _ in courses).most_common(1)[0][0]
        enc, sidx = "", []
        pts = shapes.get(need[(short, sids)])
        if pts and len(pts) >= 2:
            anchors, k = [], 0
            for sid in sids:
                k = nearest_idx(pts, stops[sid][1], stops[sid][2], k)
                anchors.append(k)
            keep = dp_simplify(pts, TOL, anchors)
            pos = {v: i for i, v in enumerate(keep)}
            enc = encode_polyline([pts[i] for i in keep])
            sidx = [pos[a] for a in anchors]
        patterns.append([short, int(d or 0), head, list(sids), cum, deps, enc, sidx])
        used.update(sids)

    # ne garder que les arrêts desservis
    stops = {k: v for k, v in stops.items() if k in used}
    routes = {k: v for k, v in routes.items() if any(p[0] == k for p in patterns)}
    patterns.sort(key=lambda p: (p[0], p[1], -len(p[5])))

    out = {
        "meta": {
            "jour": ref.isoformat(),
            "source": title,
            "construit": datetime.date.today().isoformat(),
            "n_stops": len(stops), "n_routes": len(routes), "n_patterns": len(patterns),
            "n_courses": len(seq),
        },
        "stops": stops,
        "routes": routes,
        "patterns": patterns,
    }
    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    dst = os.path.join(HERE, "lignes_kb.js")
    with io.open(dst, "w", encoding="utf-8") as f:
        f.write("window.LIGNES=")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("écrit", dst, "%.1f Mo" % (os.path.getsize(dst) / 1e6))
    print(out["meta"])


if __name__ == "__main__":
    main()
