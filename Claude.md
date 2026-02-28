# Norway Trip Planner

A Flask web application for planning road trips through Norway (or anywhere). Users can create trips with ordered stops, activities, and waypoints, visualize routes on Google Maps, and calculate driving distances.

## Tech Stack

- **Backend:** Python / Flask, SQLAlchemy ORM, SQLite
- **Frontend:** Vanilla JavaScript, Google Maps API, i18next
- **Auth:** OAuth 2.0 (Google & Microsoft) via Authlib
- **Geocoding:** geopy (Nominatim) for address validation, Google Maps for route calculation

## Project Structure

```
├── app.py                  # Flask app — all routes and API endpoints
├── models.py               # SQLAlchemy data models
├── config.py               # Configuration from environment variables
├── services.py             # GeocodingService and RouteService
├── trip_io.py              # Trip JSON import/export
├── init_db.py              # Database initialization script
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (secrets, API keys)
├── database.db             # SQLite database file
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
│   │   ├── trip_detail.js  # Trip detail page (stops, map, routes, calendar)
│   │   ├── i18n.js         # i18next setup and translation helpers
│   │   ├── theme.js        # Dark mode toggle with localStorage persistence
│   │   ├── auth.js         # Fetch wrapper — redirects to /login on 401
│   │   └── admin.js        # Admin panel entity browser
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

## Python Services

### app.py — Routes & API

**Authentication** (OAuth 2.0):
- `GET /login` — Login page with Google/Microsoft buttons
- `GET /auth/google`, `GET /auth/callback` — Google OAuth flow
- `GET /auth/microsoft`, `GET /auth/microsoft/callback` — Microsoft OAuth flow
- `GET /logout` — Clear session
- `GET /api/auth/status` — Current user info
- `@before_request` middleware enforces auth on all routes except `/login`, `/auth/`, `/static/`, `/favicon.ico`
- Access restricted to emails in the `ALLOWED_EMAILS` config list

**Pages:**
- `GET /` — Home page (trip list)
- `GET /trip/<id>` — Trip detail page
- `GET /admin` — Admin panel

**Trip API:**
- `GET /api/trips` — List all trips with stops
- `POST /api/trips` — Create trip (geocodes start/end addresses)
- `GET /api/trips/<id>` — Get trip with stops
- `PUT /api/trips/<id>` — Update trip name and addresses
- `DELETE /api/trips/<id>` — Delete trip (cascades)

**Stop API:**
- `GET /api/trips/<trip_id>/stops` — List stops ordered by start_date
- `POST /api/trips/<trip_id>/stops` — Create stop with date validation and geocoding
- `GET /api/stops/<id>` — Get stop with activities
- `PUT /api/stops/<id>` — Update stop
- `DELETE /api/stops/<id>` — Delete stop (cascades activities)

**Activity API:**
- `POST /api/stops/<stop_id>/activities` — Create activity
- `PUT /api/activities/<id>` — Update activity
- `DELETE /api/activities/<id>` — Delete activity

**Waypoint API:**
- `GET /api/trips/<trip_id>/waypoints` — List waypoints
- `POST /api/trips/<trip_id>/waypoints` — Create waypoint (auto-places in chain)
- `PUT /api/waypoints/<id>` — Update waypoint
- `DELETE /api/waypoints/<id>` — Delete waypoint (relinks chain)

**Route API:**
- `GET /api/trips/<trip_id>/route` — Calculate full route via Google Maps (returns segments with distance, duration, polyline)
- `GET /api/trips/<trip_id>/debug/route-points` — Debug: show ordered route points

**Utility:**
- `GET /api/trips/<trip_id>/locations` — List all locations in chain order
- `POST /api/validate-address` — Geocode and validate an address

**Admin API:**
- `GET /api/admin/entities` — List entity types
- `GET /api/admin/<type>` — List all entities of a type
- `DELETE /api/admin/<type>/<id>` — Delete entity

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

### config.py

Loads from `.env`: Flask settings, database URI, Google/Microsoft OAuth credentials, Google Maps API key, allowed emails whitelist.

## JavaScript Components

### main.js — Home Page

- **Trip list:** Fetches and renders trip cards in a responsive grid. Each card shows name, date range, stop count, and a delete button.
- **Create trip modal:** Form with trip name, optional start/end addresses with real-time geocoding validation (500ms debounce).
- **Address validation:** `setupAddressValidation()` attaches live validation to address inputs, showing validating/valid/invalid states.

### trip_detail.js — Trip Detail Page

The largest JS file (~91KB), managing the full trip detail experience:

- **State:** `currentTrip`, `stops[]`, `waypoints[]`, `map`, `markers[]`, `infoWindows[]`, `routePath`
- **Stop management:** CRUD operations via modals. Supports address and GPS coordinate input, date ranges, description, URL. Dates auto-calculate based on number of nights.
- **Activity management:** Add/edit/delete activities within each stop card.
- **Waypoint management:** Add waypoints between stops via insert buttons.
- **Map (Google Maps):**
  - Markers for each stop (8 distinct colors) and waypoint
  - Info windows with stop details
  - Route polylines from calculated route data
  - Click-to-center on any stop
- **Route calculation:** Calls the route API and renders segments with distance and duration.
- **Calendar view:** Visual grid showing stops by date with color coding.
- **Rendering:** `renderStops()` builds the combined stop/waypoint list with insert-waypoint buttons between each pair.

### i18n.js — Internationalization

- Configures i18next with HTTP backend loading from `/static/locales/{lng}/translation.json`
- Three languages: English, French, German (with flag emojis)
- Persists language choice in `localStorage`
- Falls back to browser language detection
- Helpers: `t(key)`, `formatDate()`, `formatDateRange()`, `createLanguageSelector()`, `changeLanguage()`, `updateAllTranslations()`
- HTML uses `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` attributes for automatic translation

### theme.js — Dark Mode

- IIFE that runs immediately to prevent flash of wrong theme
- Checks `localStorage`, falls back to `prefers-color-scheme` media query
- Sets `data-theme` attribute on `<html>` element
- Toggle button with sun/moon icon, saves preference

### auth.js — Auth Guard

- Wraps `window.fetch()` to intercept 401 responses
- Redirects to `/login` on authentication failure

### admin.js — Admin Panel

- Entity type selector (Trip, Location, Activity)
- Dynamic table rendering with all columns
- Row deletion with confirmation

## Key Design Decisions

- **Location ordering via linked list:** Stops and waypoints are ordered through `previous_location_guid` chain rather than a simple integer `order` column. This makes insertions and reordering cleaner but requires chain traversal to build the full order.
- **Single-table inheritance:** Stops and waypoints share the `locations` table with a `type` discriminator. This simplifies the chain linking since both types participate in the same ordered sequence.
- **No frontend framework:** Pure vanilla JS with i18next for translations. The `trip_detail.js` file is large (~91KB) as a consequence.
- **Server-side rendering + JSON API:** Pages are rendered by Flask/Jinja2, then hydrated with data from the JSON API via fetch calls.
