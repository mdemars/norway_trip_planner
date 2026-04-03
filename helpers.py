from datetime import datetime
from services import geocoding_service
from models import Location, Stop


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
    """Return locations for a trip ordered by stop date, waypoints preserved in segment.

    Stops are sorted by start_date. Waypoints have no date, so they keep their
    relative position within the segment they occupied in the chain: a waypoint
    that followed stop N still follows stop N after the stops are re-sorted.
    Waypoints that precede the first stop are placed at the head of the result.

    Returns a list of Location objects in order from first to last.
    Returns an empty list if no locations exist.
    """
    all_locations = db.query(Location).filter(Location.trip_id == trip_id).all()
    if not all_locations:
        return []

    location_map = {loc.guid: loc for loc in all_locations}

    # A location is a tail if nothing references its guid as a previous.
    # There may be multiple tails when the chain is broken into disconnected
    # segments (e.g. a stop was added with previous_location_guid=None midway).
    guids_referenced = {loc.previous_location_guid for loc in all_locations if loc.previous_location_guid}
    tails = [loc for loc in all_locations if loc.guid not in guids_referenced]

    # Walk backwards from every tail and concatenate the segments into one chain.
    # Stops will be re-sorted by date below, so segment order doesn't matter.
    chain = []
    visited = set()
    for tail in tails:
        segment = []
        current = tail
        while current and current.guid not in visited:
            segment.append(current)
            visited.add(current.guid)
            current = location_map.get(current.previous_location_guid)
        segment.reverse()
        chain.extend(segment)

    # Split the chain into stops and gaps (waypoints between consecutive stops).
    # gaps[i] holds waypoints that appear between stops[i-1] and stops[i];
    # gaps[0] is before the first stop, gaps[len(stops)] is after the last.
    stops_in_chain: list = []
    gaps: list = []
    current_gap: list = []

    for loc in chain:
        if isinstance(loc, Stop):
            gaps.append(current_gap)
            stops_in_chain.append(loc)
            current_gap = []
        else:
            current_gap.append(loc)
    gaps.append(current_gap)  # trailing waypoints after the last stop

    if not stops_in_chain:
        return chain  # only waypoints — return chain order unchanged

    # Sort stops by start_date; gaps keep their positional slot.
    stops_in_chain.sort(key=lambda s: s.start_date or datetime.min)

    result: list = list(gaps[0])
    for i, stop in enumerate(stops_in_chain):
        result.append(stop)
        result.extend(gaps[i + 1])
    return result
