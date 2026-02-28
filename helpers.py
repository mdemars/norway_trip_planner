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
    """Walk the location chain for a trip.

    Returns a list of Location objects in order from first to last.
    Returns an empty list if no locations exist.
    """
    all_locations = db.query(Location).filter(Location.trip_id == trip_id).all()
    if not all_locations:
        return []

    location_map = {loc.guid: loc for loc in all_locations}

    # Find the end location (the one whose guid is not referenced by any other)
    guids_referenced = {loc.previous_location_guid for loc in all_locations if loc.previous_location_guid}
    end_location = None
    for loc in all_locations:
        if loc.guid not in guids_referenced:
            end_location = loc
            break

    if not end_location:
        return []

    # Traverse backwards from end to start
    chain = []
    current = end_location
    while current:
        chain.append(current)
        if current.previous_location_guid:
            current = location_map.get(current.previous_location_guid)
        else:
            current = None

    chain.reverse()
    return chain
