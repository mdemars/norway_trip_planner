import time
import requests
from flask import Blueprint, request, jsonify
from config import Config

weather_bp = Blueprint('weather', __name__, url_prefix='/api')

# In-memory cache: key -> (data, expires_at)
_cache = {}
CACHE_TTL = 3600  # 1 hour


def _cache_key(lat, lng, date):
    return f"{round(float(lat), 2)},{round(float(lng), 2)},{date}"


@weather_bp.route('/weather', methods=['GET'])
def get_weather():
    """Fetch weather forecast for a location on a given date.

    Query params: lat, lng, date (YYYY-MM-DD)
    Returns: { available, icon, description, temp_c }
    Uses OWM 5-day/3-hour forecast; caches results for 1 hour.
    """
    lat = request.args.get('lat')
    lng = request.args.get('lng')
    date = request.args.get('date')

    if not lat or not lng or not date:
        return jsonify({'error': 'lat, lng, and date are required'}), 400

    try:
        float(lat)
        float(lng)
    except ValueError:
        return jsonify({'error': 'Invalid lat/lng'}), 400

    key = _cache_key(lat, lng, date)
    now = time.time()

    if key in _cache:
        data, expires_at = _cache[key]
        if now < expires_at:
            return jsonify(data)

    api_key = Config.OPENWEATHERMAP_API_KEY
    if not api_key:
        return jsonify({'error': 'Weather API not configured'}), 503

    try:
        resp = requests.get(
            'https://api.openweathermap.org/data/2.5/forecast',
            params={
                'lat': lat,
                'lon': lng,
                'appid': api_key,
                'units': 'metric',
                'cnt': 40,
            },
            timeout=5
        )
        resp.raise_for_status()
        forecast = resp.json()
    except requests.RequestException:
        return jsonify({'error': 'Failed to fetch weather data'}), 502

    # Find the entry closest to noon on the target date
    entries = forecast.get('list', [])
    best = None
    min_diff = float('inf')
    for entry in entries:
        dt_txt = entry.get('dt_txt', '')
        if dt_txt.startswith(date):
            hour = int(dt_txt[11:13])
            diff = abs(hour - 12)
            if diff < min_diff:
                min_diff = diff
                best = entry

    if not best and entries:
        best = entries[0]

    if not best:
        result = {'available': False}
    else:
        weather = best['weather'][0]
        result = {
            'available': True,
            'icon': weather['icon'],
            'description': weather['description'].capitalize(),
            'temp_c': round(best['main']['temp']),
        }

    _cache[key] = (result, now + CACHE_TTL)
    return jsonify(result)
