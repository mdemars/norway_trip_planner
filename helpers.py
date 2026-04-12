from datetime import datetime
from services import geocoding_service
from models import Location


def parse_iso_date(date_string):
    """Parse an ISO date string, handling the Z suffix."""
    return datetime.fromisoformat(date_string.replace('Z', '+00:00'))


def geocode_trip_location(address):
    """Geocode a trip start/end address.
    Returns (latitude, longitude) rounded to 4 decimals, or (None, None).
    """
    if not address:
        return None, None
    coords = geocoding_service.geocode_address(address)
    if coords:
        return round(coords[0], 4), round(coords[1], 4)
    return None, None


def geocode_location_fields(data):
    """Resolve latitude, longitude, and address from request data.

    Handles both 'gps' and 'address' location types.
    Returns (latitude, longitude, address).
    """
    location_type = data.get('location_type')
    latitude = None
    longitude = None
    address = None

    if location_type == 'gps':
        latitude = round(float(data['latitude']), 4)
        longitude = round(float(data['longitude']), 4)
        address = geocoding_service.reverse_geocode(latitude, longitude)
    elif location_type == 'address':
        address = data.get('address')
        coords = geocoding_service.geocode_address(address)
        if coords:
            latitude, longitude = round(coords[0], 4), round(coords[1], 4)

    return latitude, longitude, address


def get_ordered_locations(db, trip_id):
    """Return locations for a trip in chain order (via previous_location_guid).

    Walks the linked-list chain defined by previous_location_guid. Each
    location points back to its predecessor; we build a forward map and walk
    from each head (locations with no predecessor in this trip).

    If multiple disconnected chain segments exist (broken chain), each segment
    is appended in the order it is found. Callers can detect this by counting
    how many stops have previous_location_guid == None.

    Returns a list of Location objects in order from first to last.
    """
    all_locations = db.query(Location).filter(Location.trip_id == trip_id).all()
    if not all_locations:
        return []

    guids_in_trip = {loc.guid for loc in all_locations}

    # Build forward map: guid → next location (what directly follows this guid).
    # If two locations claim the same predecessor the chain is broken; first wins.
    next_map = {}
    for loc in all_locations:
        prev = loc.previous_location_guid
        if prev and prev in guids_in_trip and prev not in next_map:
            next_map[prev] = loc

    # Heads: no previous_location_guid, or it references outside this trip.
    heads = [loc for loc in all_locations
             if not loc.previous_location_guid or loc.previous_location_guid not in guids_in_trip]

    result = []
    visited = set()
    for head in heads:
        current = head
        while current and current.guid not in visited:
            result.append(current)
            visited.add(current.guid)
            current = next_map.get(current.guid)

    return result
