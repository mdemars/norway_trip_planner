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
    """Return locations for a trip ordered by stop date, waypoints preserved between stops.

    Stops are sorted by start_date. Waypoints have no date, so they are placed
    in the gap between the two stops they sit between in the chain. This is
    determined per connected segment, so disconnected chain fragments don't
    scramble each other's waypoints.

    For a gap between stop A and stop B: the waypoints are inserted immediately
    after whichever of A or B sorts earlier by date. This keeps them between
    the two surrounding stops even when dates are swapped.

    Returns a list of Location objects in order from first to last.
    Returns an empty list if no locations exist.
    """
    all_locations = db.query(Location).filter(Location.trip_id == trip_id).all()
    if not all_locations:
        return []

    location_map = {loc.guid: loc for loc in all_locations}

    # Find all tails (no other location points to them as previous_location_guid).
    # Multiple tails indicate disconnected chain fragments.
    guids_referenced = {loc.previous_location_guid for loc in all_locations if loc.previous_location_guid}
    tails = [loc for loc in all_locations if loc.guid not in guids_referenced]

    # Walk each tail backwards to rebuild connected segments in forward order.
    segments = []
    visited = set()
    for tail in tails:
        seg = []
        current = tail
        while current and current.guid not in visited:
            seg.append(current)
            visited.add(current.guid)
            current = location_map.get(current.previous_location_guid)
        seg.reverse()
        segments.append(seg)

    # For each segment, split into stops and waypoint gaps.
    # Each gap is described by (prev_stop, next_stop, [waypoints]):
    #   prev_stop=None → gap is before the first stop of the segment
    #   next_stop=None → gap is after the last stop of the segment
    all_stops = []
    gap_entries = []  # list of (prev_stop, next_stop, [waypoints])

    for seg in segments:
        seg_stops = []
        seg_gaps = []
        current_gap = []
        for loc in seg:
            if isinstance(loc, Stop):
                seg_gaps.append(current_gap)
                seg_stops.append(loc)
                current_gap = []
            else:
                current_gap.append(loc)
        seg_gaps.append(current_gap)  # trailing gap after last stop

        all_stops.extend(seg_stops)
        n = len(seg_stops)
        for i, wps in enumerate(seg_gaps):
            if not wps:
                continue
            prev_stop = seg_stops[i - 1] if i > 0 else None
            next_stop = seg_stops[i] if i < n else None
            gap_entries.append((prev_stop, next_stop, wps))

    if not all_stops:
        # No stops at all — return all waypoints in chain order
        return [loc for seg in segments for loc in seg]

    all_stops.sort(key=lambda s: s.start_date or datetime.min)
    stop_pos = {s.id: i for i, s in enumerate(all_stops)}

    # Determine the insertion slot for each gap.
    # Slot i means "insert after all_stops[i]"; slot -1 means "insert before all_stops[0]".
    # For a gap between prev_stop and next_stop, use the slot of whichever stop
    # sorts first — this keeps the waypoints between the two stops even when
    # their dates are swapped.
    insertions = {}  # slot -> list of waypoint lists (each list preserves chain order)
    for prev_stop, next_stop, wps in gap_entries:
        if prev_stop is None and next_stop is None:
            slot = -1
        elif prev_stop is None:
            # Leading gap: goes just before next_stop
            slot = stop_pos[next_stop.id] - 1
        elif next_stop is None:
            # Trailing gap: goes after prev_stop
            slot = stop_pos[prev_stop.id]
        else:
            # Middle gap: goes after whichever of the two stops sorts earlier
            slot = min(stop_pos[prev_stop.id], stop_pos[next_stop.id])
        insertions.setdefault(slot, []).append(wps)

    result = []
    for wps_list in insertions.get(-1, []):
        result.extend(wps_list)
    for i, stop in enumerate(all_stops):
        result.append(stop)
        for wps_list in insertions.get(i, []):
            result.extend(wps_list)
    return result
