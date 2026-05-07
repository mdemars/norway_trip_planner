# Collaborative Editing Notifications — Design Proposal

## Goal

When multiple users view the same trip detail page simultaneously:
1. **Edit lock toast** — when user A opens an edit form for a stop or activity, all other viewers see: _"Alice is editing Stop: Bergen"_
2. **Save toast** — when user A submits a change, all other viewers see: _"Alice updated Stop: Bergen"_ and their UI refreshes

---

## Current Stack Constraints

| Aspect | Current state | Implication |
|---|---|---|
| Server | Flask + gunicorn (WSGI) | No async I/O out of the box |
| Workers | `gunicorn` default (sync workers) | Multiple workers = no shared in-process state |
| Auth | Session-based (OAuth) | User identity is available server-side via `session` |
| DB | SQLite (dev) / PostgreSQL (prod) | Can be used as a message bus if needed |

The core challenge: **WSGI is request/response only** — the server cannot push to clients without one of the approaches below.

---

## Technology Options

### Option A — Server-Sent Events (SSE)

Each client opens a persistent `GET /api/trips/<id>/events` connection. The server streams text events as they occur. One-directional: server → client only.

**How it works here:**
1. Client opens SSE connection on page load
2. When a user opens an edit form, the client sends a `POST /api/trips/<id>/notify` with `{ action: "editing", entity: "stop", id: 42, name: "Bergen" }`
3. The server broadcasts this to all SSE subscribers for that trip
4. All other clients receive the event and show a toast

**Broadcast mechanism options (required because gunicorn has multiple workers):**

- **Redis pub/sub** — each worker subscribes to a Redis channel per trip; a notify request publishes to that channel; SSE handlers yield events. Requires Redis.
- **PostgreSQL LISTEN/NOTIFY** — same idea using Postgres's native pub/sub. No extra service needed if already on Postgres. Does not work with SQLite.
- **In-process with 1 worker** — simplest; only viable for a personal/small app running `gunicorn -w 1` or `flask run`.

**Pros:** Simple client code (`EventSource` API, ~10 lines). No new framework. Works with Flask as-is using `Response(stream_with_context(...))`.

**Cons:** Requires either Redis/Postgres pub/sub or single-worker constraint. HTTP/1.1 browsers limit to 6 connections per host — one SSE stream uses one. One-way only (client still uses regular `fetch` to send notifications).

**Effort:** Medium. ~150 lines Python, ~80 lines JS.

---

### Option B — WebSockets via Flask-SocketIO

Add `flask-socketio` + `eventlet` (or `gevent`). Clients connect via WebSocket on page load and join a "room" per trip ID. Messages are broadcast to the room.

**How it works here:**
1. Client connects: `socket.emit('join', { trip_id: 42 })`
2. When a user opens an edit form: `socket.emit('editing', { entity: 'stop', id: 5, name: 'Bergen' })`
3. Server broadcasts to the room: `socketio.emit('editing', data, room=f'trip_{trip_id}', skip_sid=sender_sid)`
4. All other clients receive it and show a toast

**Multi-worker:** Flask-SocketIO supports Redis as a message queue (`socketio = SocketIO(app, message_queue='redis://...')`) to coordinate across workers.

**Pros:** Full-duplex (server can also push proactively on DB changes). Clean room-based fan-out. Well-documented library. Also enables future features (live cursor positions, real-time stop list updates, etc.).

**Cons:** Requires switching gunicorn workers to `eventlet` or `gevent` (monkey-patching). Adds 2 dependencies (`flask-socketio`, `eventlet`). Slightly more complex deployment. Still needs Redis for multi-worker prod.

**Effort:** Medium-high. ~100 lines Python, ~120 lines JS. Gunicorn config change required.

---

### Option C — Short Polling

Clients `GET /api/trips/<id>/activity?since=<timestamp>` every 3–5 seconds. The server returns any edit events that occurred after `since`.

Events are stored in a lightweight in-memory store (dict keyed by trip ID) or a small `trip_events` DB table, kept for the last 60 seconds.

**Pros:** Zero new dependencies. Works with any number of workers (if using DB). No persistent connections. Simplest to reason about.

**Cons:** 3–5 second notification lag. Every open tab generates polling requests. Feels less "live". Slightly wasteful for a rarely-used collaborative scenario.

**Effort:** Low. ~60 lines Python, ~50 lines JS.

---

## Recommendation

**For this app (personal/small team, simple deployment): Option A — SSE with single-worker or in-process broadcast.**

Since this is a personal trip planner with a small whitelist of users, running gunicorn with a single worker (`-w 1`) is perfectly fine. This eliminates the Redis requirement entirely. SSE is natively supported by all modern browsers, requires no new JS library, and the server-side streaming is ~30 lines of Flask code.

If the app ever moves to multi-worker production, swapping in Redis pub/sub is a contained change only in the SSE endpoint.

**Option B (SocketIO) is the better long-term architecture** if you anticipate richer real-time features (live stop reordering, shared cursors, etc.) — but it's overkill for toast notifications alone.

---

## Recommended Implementation Plan (Option A — SSE)

### Phase 1 — Server: in-process event bus

**`event_bus.py`** (new file, ~40 lines)
```
EventBus
  - subscribers: dict[trip_id → list[Queue]]
  + subscribe(trip_id) → Queue
  + unsubscribe(trip_id, queue)
  + publish(trip_id, event_dict)
```
A simple in-process queue-per-subscriber. No external dependencies.

---

### Phase 2 — Server: two new endpoints in `routes/routing.py` (or a new `routes/presence.py`)

**`GET /api/trips/<id>/events`** — SSE stream
- Subscribes the caller to the event bus for this trip
- Streams `data: <json>\n\n` lines indefinitely
- On client disconnect, unsubscribes and cleans up
- Sends a heartbeat comment (`: ping\n\n`) every 25s to keep the connection alive

**`POST /api/trips/<id>/notify`** — publish an event
- Body: `{ "action": "editing"|"saved"|"left", "entity": "stop"|"activity", "entity_id": int, "entity_name": str }`
- Reads `user_name` from `session`
- Calls `event_bus.publish(trip_id, { ...payload, "user": user_name, "ts": now })`
- Returns `204 No Content`

---

### Phase 3 — Gunicorn config

In `Procfile` or start script, ensure single worker:
```
gunicorn -w 1 --timeout 120 "app:create_app()"
```
The `--timeout 120` prevents gunicorn from killing long-lived SSE connections.

---

### Phase 4 — Frontend: SSE client (`static/js/trip/presence.js`, new file ~80 lines)

**On page load (`init.js`):**
```js
initPresence(tripId)   // opens EventSource, wires handlers
```

**`initPresence(tripId)`:**
- Creates `new EventSource(/api/trips/${tripId}/events)`
- On `message`: parses JSON, calls `showPresenceToast(event)`
- On error: backs off and reconnects after 5s

**`notifyEditing(entity, entityId, entityName)`** — called from `handlers.js` when a user opens an edit modal:
```js
fetch(`/api/trips/${tripId}/notify`, {
    method: 'POST',
    body: JSON.stringify({ action: 'editing', entity, entity_id: entityId, entity_name: entityName })
})
```

**`notifySaved(entity, entityId, entityName)`** — called from `handlers.js` after a successful save API call.

**`showPresenceToast(event)`:**
- Renders a non-blocking toast (different style from error/success toasts — e.g. blue, bottom-left)
- Format: _"Alice is editing Stop: Bergen"_ / _"Alice saved Activity: Hike to Pulpit Rock"_
- Auto-dismisses after 4s; does not stack more than 3 at once

---

### Phase 5 — Wire into `handlers.js`

Add `notifyEditing(...)` calls at the top of each edit handler (before the modal opens):
- `handleEditStop` → `notifyEditing('stop', stopId, stopName)`
- `handleEditActivity` → `notifyEditing('activity', actId, actName)`

Add `notifySaved(...)` calls after each successful API response:
- After `updateStop` resolves → `notifySaved('stop', stopId, stopName)`
- After `updateActivity` resolves → `notifySaved('activity', actId, actName)`

---

### Phase 6 — CSS

Add `.presence-toast` styles to `style.css`:
- Fixed, bottom-left corner
- Blue accent (distinct from error/success toasts which are top-right)
- Slide-in from left animation
- Stack vertically with `gap`

---

## File Change Summary

| File | Change |
|---|---|
| `event_bus.py` | **New** — in-process pub/sub |
| `routes/presence.py` | **New** — SSE stream + notify endpoints |
| `app.py` | Register `presence_bp` |
| `static/js/trip/presence.js` | **New** — EventSource client + toast rendering |
| `static/js/trip/handlers.js` | Add `notifyEditing` / `notifySaved` calls |
| `static/js/trip/init.js` | Call `initPresence(tripId)` on load |
| `templates/trip_detail.html` | Add `<script src=".../presence.js">` |
| `static/css/style.css` | Add `.presence-toast` styles |
| `requirements.txt` | No changes needed |

Total: ~300 lines of new code across 3 new files + small additions to 4 existing files.

---

## Not in Scope

- **Edit locking** (preventing two users from saving the same stop concurrently) — this proposal is notification-only. True locking requires a `locked_by` / `locked_at` column on `locations` and a lock-acquisition API, which is significantly more complex.
- **Presence avatars / user list** — showing who is currently on the page. Doable with the same SSE infrastructure but not part of this plan.
- **Multi-worker / Redis upgrade path** — deferred. When needed, `event_bus.py` is the only file that changes.
