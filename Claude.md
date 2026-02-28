# Norway Trip Planner

A Flask web application for planning road trips through Norway (or anywhere). Users can create trips with ordered stops, activities, and waypoints, visualize routes on Google Maps, and calculate driving distances.

## Tech Stack

- **Backend:** Python / Flask (Blueprints), SQLAlchemy ORM, SQLite
- **Frontend:** Vanilla JavaScript, Google Maps API, i18next
- **Auth:** OAuth 2.0 (Google & Microsoft) via Authlib
- **Geocoding:** geopy (Nominatim) for address validation, Google Maps for route calculation

## Project Structure

```
├── app.py                  # Application factory (create_app), middleware, blueprint registration
├── models.py               # SQLAlchemy data models
├── config.py               # Configuration from environment variables
├── services.py             # GeocodingService and RouteService
├── helpers.py              # Shared utilities (geocoding, chain traversal, date parsing)
├── backup_db.py            # Database backup/restore logic
├── trip_io.py              # Trip JSON import/export
├── init_db.py              # Database initialization script
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (secrets, API keys)
├── database.db             # SQLite database file
├── routes/
│   ├── __init__.py
│   ├── auth.py             # auth_bp — login, OAuth flows, logout, auth status
│   ├── web.py              # web_bp — index page, trip detail page, favicon
│   ├── trips.py            # trips_bp — /api/trips CRUD
│   ├── stops.py            # stops_bp — /api/stops CRUD
│   ├── activities.py       # activities_bp — /api/activities CRUD
│   ├── waypoints.py        # waypoints_bp — /api/waypoints CRUD
│   ├── routing.py          # routing_bp — route calc, debug, locations, address validation
│   ├── admin.py            # admin_bp — admin page + entity API
│   └── backups.py          # backups_bp — database backup/restore
├── templates/
│   ├── index.html          # Home page — trip list
│   ├── trip_detail.html    # Trip detail page — stops, map, calendar
│   ├── login.html          # OAuth login page
│   └── admin.html          # Admin entity browser
├── static/
│   ├── css/
│   │   ├── style.css       # Main stylesheet (light/dark mode)
│   │   ├── login.css       # Login page styles
│   │   └── admin.css       # Admin panel styles
│   ├── js/
│   │   ├── main.js         # Home page logic (trip CRUD, address validation)
│   │   ├── i18n.js         # i18next setup and translation helpers
│   │   ├── theme.js        # Dark mode toggle with localStorage persistence
│   │   ├── auth.js         # Fetch wrapper — redirects to /login on 401
│   │   ├── admin.js        # Admin panel entity browser
│   │   └── trip/           # Trip detail page modules
│   │       ├── state.js    # TripApp namespace + global state + constants
│   │       ├── ui.js       # Modals, notifications, escapeHtml, formatDateForInput
│   │       ├── api.js      # All fetch/create/update/delete API calls
│   │       ├── render.js   # renderStops, createStopCard, createActivityItem, createWaypointCard
│   │       ├── map.js      # initMap, updateMap, drawRoute, showStopOnMap
│   │       ├── calendar.js # renderCalendar, renderMonth, getStopsForDay
│   │       ├── handlers.js # All form submit + CRUD handlers
│   │       └── init.js     # DOMContentLoaded event wiring, data loading
│   ├── locales/
│   │   ├── en/translation.json
│   │   ├── fr/translation.json
│   │   └── de/translation.json
│   └── images/
│       └── campervan.png   # App logo/favicon
```

## Data Model

The database has three tables: `trips`, `locations`, and `activities`.

### Trip

The top-level entity representing a journey.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment ID |
| name | String | Trip name |
| created_at | DateTime | Creation timestamp |
| start_location_address | String | Starting address (optional) |
| start_location_latitude | Float | Starting latitude |
| start_location_longitude | Float | Starting longitude |
| start_location_guid | String | UUID linking into the location chain |
| end_location_address | String | Ending address (optional) |
| end_location_latitude | Float | Ending latitude |
| end_location_longitude | Float | Ending longitude |
| end_location_guid | String | UUID linking into the location chain |

A trip has many **Stops** (cascade delete).

### Location (Single-Table Inheritance)

The `locations` table uses SQLAlchemy single-table inheritance to store both **Stops** and **Waypoints**. The `type` column discriminates between them.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment ID |
| type | String | Discriminator: `"stop"` or `"waypoint"` |
| guid | String | UUID — unique identifier for chain linking |
| trip_id | Integer FK → trips.id | Parent trip |
| name | String | Location name |
| location_type | String | `"address"` or `"gps"` |
| latitude | Float | Latitude coordinate |
| longitude | Float | Longitude coordinate |
| address | String | Human-readable address (optional) |
| description | String | User notes (optional) |
| url | String | Reference URL (optional) |
| start_date | Date | Arrival date (stops only) |
| end_date | Date | Departure date (stops only) |
| previous_location_guid | String FK → locations.guid | Previous location in the ordered chain |

**Ordering:** Locations are ordered via a linked-list chain using `guid` and `previous_location_guid`. The trip's `start_location_guid` is the head of the chain. Each location points back to its predecessor.

### Stop (extends Location)

A named destination where the traveller stays for a date range. Has many **Activities** (cascade delete).

### Waypoint (extends Location)

An intermediate route point between stops. Has no date range or activities.

### Activity

Something to do at a stop.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment ID |
| stop_id | Integer FK → locations.id | Parent stop |
| name | String | Activity name |
| description | String | Details (optional) |
| url | String | Reference URL (optional) |

## Python Backend

### app.py — Application Factory

`create_app()` initializes Flask, configures CORS/ProxyFix, sets up OAuth (Google & Microsoft), registers all 9 blueprints, and defines app-wide middleware:
- `@before_request` — enforces authentication on all routes except `/login`, `/auth/`, `/static/`, `/favicon.ico`
- `@context_processor` — injects user session data into all templates

OAuth clients are stored on `app.extensions['google_oauth']` and `app.extensions['microsoft_oauth']` for blueprint access via `current_app`.

### helpers.py — Shared Utilities

| Function | Purpose |
|----------|---------|
| `geocode_trip_location(address)` | Geocode a trip start/end address → `(lat, lng)` rounded to 4 decimals |
| `geocode_location_fields(data)` | Resolve lat/lng/address from request data (handles GPS and address types) |
| `get_ordered_locations(db, trip_id)` | Walk the location chain → ordered list of Location objects |
| `parse_iso_date(date_string)` | Parse ISO date string with Z suffix handling |

### Route Blueprints

| Blueprint | File | URL prefix | Routes |
|-----------|------|-----------|--------|
| `auth_bp` | `routes/auth.py` | _(none)_ | `/login`, `/auth/google`, `/auth/callback`, `/auth/microsoft`, `/auth/microsoft/callback`, `/logout`, `/api/auth/status` |
| `web_bp` | `routes/web.py` | _(none)_ | `/`, `/trip/<id>`, `/favicon.ico` |
| `trips_bp` | `routes/trips.py` | `/api` | `/trips` GET/POST, `/trips/<id>` GET/PUT/DELETE |
| `stops_bp` | `routes/stops.py` | `/api` | `/trips/<id>/stops` GET/POST, `/stops/<id>` GET/PUT/DELETE, `/stops/reorder` POST |
| `activities_bp` | `routes/activities.py` | `/api` | `/stops/<id>/activities` POST, `/activities/<id>` PUT/DELETE |
| `waypoints_bp` | `routes/waypoints.py` | `/api` | `/trips/<id>/waypoints` GET/POST, `/waypoints/<id>` PUT/DELETE |
| `routing_bp` | `routes/routing.py` | `/api` | `/trips/<id>/route`, `/trips/<id>/debug/route-points`, `/trips/<id>/locations`, `/validate-address` POST |
| `admin_bp` | `routes/admin.py` | _(none)_ | `/admin`, `/api/admin/entities`, `/api/admin/<type>` GET, `/api/admin/<type>/<id>` DELETE |
| `backups_bp` | `routes/backups.py` | `/api` | `/backups` GET, `/backup` POST, `/restore` POST |

### services.py

**GeocodingService** — wraps `geopy.Nominatim`:
- `geocode_address(address)` → `(lat, lng)` or `None`
- `reverse_geocode(lat, lng)` → address string or `None`

**RouteService** — wraps `googlemaps` client:
- `calculate_route(stops)` → `{ total_distance_km, segments[] }` with distance, duration, and polyline per segment
- `calculate_distance_between_points(lat1, lng1, lat2, lng2)` → distance in km

### trip_io.py

- `export_trip(trip_id)` → JSON dict of full trip data (stops, activities, waypoints)
- `import_trip(data)` → creates a new trip from JSON with all nested entities

### backup_db.py

- `create_backup(db_path, backup_dir, filename_pattern, max_backups)` → creates timestamped SQLite backup
- `restore_backup(backup_path)` → restores database from backup file
- `list_backups()` → returns list of available backup files

### config.py

Loads from `.env`: Flask settings, database URI, Google/Microsoft OAuth credentials, Google Maps API key, allowed emails whitelist.

## JavaScript Frontend

### Shared State (trip detail page)

The trip detail page uses a `window.TripApp` namespace for shared state across modules:
- `currentTrip`, `stops[]`, `waypoints[]` — data
- `map`, `markers[]`, `infoWindows[]`, `routePath` — Google Maps objects
- `pendingStopUpdate` — temporary state for duration change handling
- `STOP_COLORS` — 8 distinct colors for stop markers

Each module aliases `const App = window.TripApp;` and attaches functions to it. Functions called from HTML `onclick` attributes are also exposed on `window`.

### Trip Detail Modules (`static/js/trip/`)

| File | Purpose |
|------|---------|
| `state.js` | Initializes `window.TripApp` namespace with state variables and constants |
| `ui.js` | `openModal`, `closeModal`, `showNotification`, `showError`, `showSuccess`, `escapeHtml`, `formatDateForInput` |
| `api.js` | All API calls: `fetchTrip`, `updateTrip`, `deleteTrip`, `fetchStops`, `createStop`, `updateStop`, `deleteStopApi`, `createActivity`, `deleteActivity`, `calculateRoute`, `fetchWaypoints`, `createWaypoint`, `deleteWaypoint` |
| `render.js` | `renderStops` (builds combined stop/waypoint list), `createStopCard`, `createActivityItem`, `createWaypointCard` |
| `map.js` | `initMap` (Google Maps init), `updateMap` (rebuild all markers), `drawRoute` (polyline), `showStopOnMap` |
| `calendar.js` | `renderCalendar`, `renderMonth`, `getStopsForDay`, `handleCalendarStopClick` |
| `handlers.js` | All form/CRUD handlers for stops, activities, waypoints, trips, route calculation, duration changes |
| `init.js` | `loadTrip`, `loadStops`, `DOMContentLoaded` event wiring, language change handler, CSS animations |

Script loading order in `trip_detail.html`: state → ui → api → render → map → calendar → handlers → init.

### Other JS Files

| File | Purpose |
|------|---------|
| `main.js` | Home page: trip list rendering, create trip modal, address validation |
| `i18n.js` | i18next config, `t()`, `formatDate()`, `formatDateRange()`, `createLanguageSelector()`, language persistence |
| `theme.js` | Dark mode toggle with `localStorage` and `prefers-color-scheme` fallback |
| `auth.js` | Wraps `window.fetch()` to redirect to `/login` on 401 |
| `admin.js` | Admin panel: entity selector, dynamic table, row deletion |

## Key Design Decisions

- **Location ordering via linked list:** Stops and waypoints are ordered through `previous_location_guid` chain rather than a simple integer `order` column. This makes insertions and reordering cleaner but requires chain traversal to build the full order.
- **Single-table inheritance:** Stops and waypoints share the `locations` table with a `type` discriminator. This simplifies the chain linking since both types participate in the same ordered sequence.
- **Flask Blueprints:** Routes are organized into 9 blueprints by domain (auth, trips, stops, activities, waypoints, routing, admin, backups, web pages). Shared logic is extracted into `helpers.py`.
- **JS namespace pattern:** The trip detail page uses `window.TripApp` as a shared namespace across 8 module files. No build tool — plain `<script>` tags loaded in dependency order.
- **Server-side rendering + JSON API:** Pages are rendered by Flask/Jinja2, then hydrated with data from the JSON API via fetch calls.
