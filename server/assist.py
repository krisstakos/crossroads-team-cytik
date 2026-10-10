import math
import time

import requests
from flask import Blueprint, jsonify, request

from .common import ApiError, login_required, rate_limit

bp = Blueprint("assist", __name__, url_prefix="/api")

OVERPASS = "https://overpass-api.de/api/interpreter"
# what to look for per kind of task (OpenStreetMap tags)
QUERIES = {
    "gym": ['["leisure"~"fitness_centre|sports_centre"]'],
    "run": ['["leisure"~"track|park"]'],
    "study": ['["amenity"~"library|cafe"]'],
    "yoga": ['["sport"="yoga"]', '["leisure"="fitness_centre"]'],
    "art": ['["amenity"="arts_centre"]', '["craft"]'],
    "cook": ['["shop"~"supermarket|convenience|greengrocer"]'],
}
_cache = {}
TTL = 600


def km_between(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(a))


def fetch_places(kind, lat, lon, radius=3000):
    body = "[out:json][timeout:8];(" + "".join(
        '{}(around:{},{},{}){};'.format(t, radius, lat, lon, q) for q in QUERIES[kind] for t in ("node", "way")) + ");out center 40;"
    r = requests.post(OVERPASS, data={"data": body}, timeout=9)
    r.raise_for_status()
    out = []
    for el in r.json().get("elements", []):
        name = (el.get("tags") or {}).get("name")
        c = el if "lat" in el else el.get("center")
        if name and c:
            out.append({"name": name[:60], "km": round(km_between(lat, lon, c["lat"], c["lon"]), 1)})
    out.sort(key=lambda p: p["km"])
    seen, uniq = set(), []
    for p in out:
        if p["name"] not in seen:
            seen.add(p["name"]); uniq.append(p)
    return uniq[:4]


@bp.get("/assist/places")
@login_required
def places(u):
    """Real nearby places from OpenStreetMap. Always answers 200; `source` says whether the data is live."""
    kind = request.args.get("kind", "")
    try:
        lat, lon = float(request.args["lat"]), float(request.args["lon"])
    except (KeyError, ValueError):
        raise ApiError("VALIDATION", "lat and lon are required.", 422)
    if kind not in QUERIES or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ApiError("VALIDATION", "Unknown kind or coordinates.", 422)
    rate_limit("assist:%d" % u.id, 20)
    key = (kind, round(lat, 2), round(lon, 2))   # ~1 km cells keep the cache useful and the exact position private
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL:
        return jsonify({"places": hit[1], "source": "openstreetmap"})
    try:
        found = fetch_places(kind, lat, lon)
    except Exception:  # Overpass is a shared free service: slow or down is normal, so fall back quietly
        return jsonify({"places": [], "source": "unavailable"})
    _cache[key] = (time.time(), found)
    return jsonify({"places": found, "source": "openstreetmap"})
