import json
import requests

BASE_URL = "http://localhost:5000/api"


def dump_trip(trip_id, filepath):
    """Dump a trip to a JSON file."""
    r = requests.get(f"{BASE_URL}/trips/{trip_id}")
    r.raise_for_status()
    with open(filepath, 'w') as f:
        json.dump(r.json(), f, indent=2)


def load_trip(filepath):
    """Load a trip from a JSON file into the DB."""
    with open(filepath) as f:
        data = json.load(f)

    # Create trip
    trip = requests.post(f"{BASE_URL}/trips", json={"name": data["name"]}).json()
    trip_id = trip["id"]

    # Update trip with start/end locations
    requests.put(f"{BASE_URL}/trips/{trip_id}", json={
        "start_location_address": data.get("start_location_address"),
        "end_location_address": data.get("end_location_address")
    })

    # Create stops with activities
    for stop in data.get("stops", []):
        s = requests.post(f"{BASE_URL}/trips/{trip_id}/stops", json={
            "name": stop["name"],
            "start_date": stop["start_date"],
            "end_date": stop["end_date"],
            "location_type": stop.get("location_type", "address"),
            "address": stop.get("address"),
            "latitude": stop.get("latitude"),
            "longitude": stop.get("longitude")
        }).json()
        if 'error' in s:
            print('Error creating stop:', s['error'])
            continue
        
        print('Created stop:', s)
        for act in stop.get("activities", []):
            requests.post(f"{BASE_URL}/stops/{s['id']}/activities", json=act)

    # Create waypoints
    for wp in data.get("waypoints", []):
        requests.post(f"{BASE_URL}/trips/{trip_id}/waypoints", json={
            "name": wp["name"],
            "location_type": wp.get("location_type", "address"),
            "address": wp.get("address"),
            "latitude": wp.get("latitude"),
            "longitude": wp.get("longitude")
        })

    return trip_id


if __name__ == "__main__":
    import sys
    import os
    if len(sys.argv) < 3:
        print("Usage: python trip_io.py dump <trip_id>")
        print("       python trip_io.py load <trip_id>")
        sys.exit(1)
    cmd, trip_id = sys.argv[1], int(sys.argv[2])
    filepath = f"./json_dump/{trip_id}.json"
    os.makedirs("./json_dump", exist_ok=True)
    if cmd == "dump":
        dump_trip(trip_id, filepath)
        print(f"Dumped trip {trip_id} to {filepath}")
    elif cmd == "load":
        new_id = load_trip(filepath)
        print(f"Loaded trip from {filepath}, new trip ID: {new_id}")
