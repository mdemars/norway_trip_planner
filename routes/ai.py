"""
AI trip-planner blueprint
=========================
POST  /api/ai/plan                – start an agentic run; returns {prompt_id, model}
GET   /api/ai/plan/<id>/stream    – SSE stream of progress events
POST  /api/ai/plan/<id>/cancel    – request cancellation
GET   /api/ai/prompts             – list recent prompts (for inspiration panel)
DELETE /api/ai/prompts/<id>       – admin: delete a prompt record
"""

from __future__ import annotations

import json
import queue
import re
import threading
from datetime import date, timedelta

import httpx
from flask import Blueprint, Response, jsonify, request, stream_with_context

from config import Config
from models import AiPrompt, Trip, get_db

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# ── Per-run state (in-memory) ─────────────────────────────────────────────────
_streams: dict[int, queue.Queue] = {}       # prompt_id → event queue
_cancel_events: dict[int, threading.Event] = {}
_lock = threading.Lock()

# ── Model selection ───────────────────────────────────────────────────────────
_SMALL_TASK_RE = re.compile(
    r"\badd\s+(a\s+)?(stop|activity|bookmark)\b"
    r"|\binsert\s+(a\s+)?stop\b"
    r"|\bappend\s+(a\s+)?stop\b",
    re.IGNORECASE,
)

def _select_model(prompt: str) -> str:
    if _SMALL_TASK_RE.search(prompt):
        return "claude-haiku-4-5-20251001"
    return "claude-sonnet-4-6"


# ── System prompt ─────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """\
You are a trip planning assistant for the Norway Trip Planner app.

Your ONLY allowed actions are:
- Validate addresses with validate_address
- List or get trips with list_trips / get_trip
- Create new trips with create_trip
- Retrieve, add, or reorder stops: get_stops / add_stop / reorder_stops
- Add activities to stops: add_activity
- Add bookmarks to trips: add_bookmark / get_bookmarks
- Check straight-line segment distances: check_segments
- Return the trip URL: get_trip_url

You MUST NOT delete, modify, or remove any existing data.
You MUST respond to the user in the same language they used for their prompt.

Workflow:
1. validate_address for each stop before adding it.
2. create_trip (if a new trip is needed).
3. add_stop for each location, in order.
4. After each add_stop, call check_segments — if a segment exceeds 500 km, insert an
   intermediate stop and re-check.
5. add_activity for each notable thing to do at each stop.
6. add_bookmark for any useful reference URLs (e.g. hiking trails, ferry timetables,
   accommodation listings, tourist info). Add at least 2–3 bookmarks per trip.
7. At the end call get_trip_url and include the link in your final reply to the user.
"""

# ── Anthropic tool schemas ────────────────────────────────────────────────────
_TOOLS = [
    {
        "name": "validate_address",
        "description": "Validate a place name or address and return GPS coordinates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string"}
            },
            "required": ["address"],
        },
    },
    {
        "name": "list_trips",
        "description": "List all existing trips (id, name, stop count, created_at).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_trip",
        "description": "Get full details of a trip including all stops and activities.",
        "input_schema": {
            "type": "object",
            "properties": {"trip_id": {"type": "integer"}},
            "required": ["trip_id"],
        },
    },
    {
        "name": "create_trip",
        "description": "Create a new empty trip. Returns the trip object including its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "start_address": {"type": "string"},
                "end_address": {"type": "string"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "get_stops",
        "description": "Return all stops for a trip in chain order.",
        "input_schema": {
            "type": "object",
            "properties": {"trip_id": {"type": "integer"}},
            "required": ["trip_id"],
        },
    },
    {
        "name": "add_stop",
        "description": (
            "Add a stop to a trip. Stops are appended to the end of the chain automatically. "
            "Always call validate_address first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "trip_id": {"type": "integer"},
                "name": {"type": "string"},
                "address": {"type": "string"},
                "start_date": {"type": "string", "description": "YYYY-MM-DD (optional)"},
                "nights": {"type": "integer", "description": "Number of nights (optional)"},
                "description": {"type": "string"},
            },
            "required": ["trip_id", "name", "address"],
        },
    },
    {
        "name": "add_activity",
        "description": "Add an activity to a stop.",
        "input_schema": {
            "type": "object",
            "properties": {
                "stop_id": {"type": "integer"},
                "name": {"type": "string"},
                "description": {"type": "string"},
                "url": {"type": "string"},
            },
            "required": ["stop_id", "name"],
        },
    },
    {
        "name": "add_bookmark",
        "description": (
            "Save a reference URL as a bookmark on a trip. "
            "Use for hiking trails, ferry schedules, accommodation listings, tourist info, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "trip_id": {"type": "integer"},
                "url": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["trip_id", "url"],
        },
    },
    {
        "name": "get_bookmarks",
        "description": "List all bookmarks saved on a trip.",
        "input_schema": {
            "type": "object",
            "properties": {"trip_id": {"type": "integer"}},
            "required": ["trip_id"],
        },
    },
    {
        "name": "check_segments",
        "description": (
            "Fast Haversine distance check between consecutive stops. "
            "Call after every add_stop to catch over-limit legs immediately."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "trip_id": {"type": "integer"},
                "max_km": {"type": "number", "default": 500},
            },
            "required": ["trip_id"],
        },
    },
    {
        "name": "reorder_stops",
        "description": "Reorder the stops of a trip by supplying the desired stop ID sequence.",
        "input_schema": {
            "type": "object",
            "properties": {
                "trip_id": {"type": "integer"},
                "stop_ids": {"type": "array", "items": {"type": "integer"}},
            },
            "required": ["trip_id", "stop_ids"],
        },
    },
    {
        "name": "get_trip_url",
        "description": "Return the browser URL for viewing and editing the trip in the web app.",
        "input_schema": {
            "type": "object",
            "properties": {"trip_id": {"type": "integer"}},
            "required": ["trip_id"],
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────
def _execute_tool(name: str, inputs: dict, base_url: str, api_token: str):
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    def get(path, params=None):
        r = httpx.get(f"{base_url}{path}", headers=headers, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def post(path, data):
        r = httpx.post(f"{base_url}{path}", json=data, headers=headers, timeout=30)
        r.raise_for_status()
        return r.json()

    if name == "validate_address":
        return post("/api/validate-address", {"address": inputs["address"]})

    if name == "list_trips":
        return get("/api/trips")

    if name == "get_trip":
        return get(f"/api/trips/{inputs['trip_id']}")

    if name == "create_trip":
        payload: dict = {"name": inputs["name"]}
        if inputs.get("start_address"):
            payload["start_location_address"] = inputs["start_address"]
        if inputs.get("end_address"):
            payload["end_location_address"] = inputs["end_address"]
        return post("/api/trips", payload)

    if name == "get_stops":
        return get(f"/api/trips/{inputs['trip_id']}/stops")

    if name == "add_stop":
        payload = {
            "name": inputs["name"],
            "location_type": "address",
            "address": inputs["address"],
        }
        if inputs.get("description"):
            payload["description"] = inputs["description"]
        if inputs.get("start_date"):
            payload["start_date"] = inputs["start_date"]
            if inputs.get("nights") is not None:
                end = date.fromisoformat(inputs["start_date"]) + timedelta(days=int(inputs["nights"]))
                payload["end_date"] = end.isoformat()
        return post(f"/api/trips/{inputs['trip_id']}/stops", payload)

    if name == "add_activity":
        payload = {"name": inputs["name"]}
        if inputs.get("description"):
            payload["description"] = inputs["description"]
        if inputs.get("url"):
            payload["url"] = inputs["url"]
        return post(f"/api/stops/{inputs['stop_id']}/activities", payload)

    if name == "add_bookmark":
        payload = {"url": inputs["url"]}
        if inputs.get("description"):
            payload["description"] = inputs["description"]
        return post(f"/api/trips/{inputs['trip_id']}/bookmarks", payload)

    if name == "get_bookmarks":
        return get(f"/api/trips/{inputs['trip_id']}/bookmarks")

    if name == "check_segments":
        return get(f"/api/trips/{inputs['trip_id']}/segments", params={"max_km": inputs.get("max_km", 500)})

    if name == "reorder_stops":
        return post(f"/api/trips/{inputs['trip_id']}/reorder", {"stop_ids": inputs["stop_ids"]})

    if name == "get_trip_url":
        return f"{base_url}/trip/{inputs['trip_id']}"

    return {"error": f"Unknown tool: {name}"}


# ── Human-readable labels / summaries ─────────────────────────────────────────
def _tool_label(name: str, inputs: dict) -> str:
    labels: dict[str, str] = {
        "validate_address": f"Validating: {inputs.get('address', '')}",
        "create_trip":      f"Creating trip: {inputs.get('name', '')}",
        "list_trips":       "Listing existing trips",
        "get_trip":         f"Loading trip #{inputs.get('trip_id', '')}",
        "get_stops":        f"Loading stops for trip #{inputs.get('trip_id', '')}",
        "add_stop":         f"Adding stop: {inputs.get('name', '')}",
        "add_activity":     f"Adding activity: {inputs.get('name', '')}",
        "add_bookmark":     f"Adding bookmark: {inputs.get('description') or inputs.get('url', '')}",
        "get_bookmarks":    "Loading bookmarks",
        "check_segments":   "Checking segment distances",
        "reorder_stops":    "Reordering stops",
        "get_trip_url":     "Getting trip URL",
    }
    return labels.get(name, name)


def _tool_summary(name: str, result) -> str:
    if name == "validate_address" and isinstance(result, dict):
        return "Address valid" if result.get("valid") else f"Invalid: {result.get('error', '')}"
    if name == "create_trip" and isinstance(result, dict):
        return f"Trip created (ID: {result.get('id')})"
    if name == "add_stop" and isinstance(result, dict):
        return f"Stop added: {result.get('name')} (ID: {result.get('id')})"
    if name == "add_activity" and isinstance(result, dict):
        return f"Activity added: {result.get('name')}"
    if name == "add_bookmark" and isinstance(result, dict):
        return "Bookmark saved"
    if name == "check_segments" and isinstance(result, dict):
        if result.get("all_ok"):
            return "All segments within limit"
        warnings = result.get("warnings", [])
        return f"{len(warnings)} segment(s) over limit"
    return "Done"


# ── DB helpers ────────────────────────────────────────────────────────────────
def _set_status(db, prompt_id: int, status: str, trip_id: int | None = None) -> None:
    try:
        p = db.query(AiPrompt).filter(AiPrompt.id == prompt_id).first()
        if p:
            p.status = status
            if trip_id is not None:
                p.trip_id = trip_id
            db.commit()
    except Exception:
        db.rollback()


def _set_trip(db, prompt_id: int, trip_id: int) -> None:
    try:
        p = db.query(AiPrompt).filter(AiPrompt.id == prompt_id).first()
        if p:
            p.trip_id = trip_id
            db.commit()
    except Exception:
        db.rollback()


# ── Agentic loop (background thread) ─────────────────────────────────────────
def _run_agent(
    prompt_id: int,
    user_prompt: str,
    selected_trip_id: int | None,
    model: str,
    q: queue.Queue,
    cancel: threading.Event,
    base_url: str,
    api_token: str,
    anthropic_key: str,
    max_iterations: int,
) -> None:
    import anthropic

    client = anthropic.Anthropic(api_key=anthropic_key)
    db = None
    trip_id: int | None = None

    def emit(event_type: str, **kwargs) -> None:
        q.put({"type": event_type, **kwargs})

    try:
        db = get_db()

        system = _SYSTEM_PROMPT
        if selected_trip_id:
            system += (
                f"\n\nThe user has pre-selected trip ID {selected_trip_id}. "
                "Use this trip when adding stops or activities unless they explicitly ask to create a new trip."
            )

        messages: list[dict] = [{"role": "user", "content": user_prompt}]
        emit("status", message="Starting…")

        for iteration in range(max_iterations):
            if cancel.is_set():
                emit("cancelled")
                _set_status(db, prompt_id, "cancelled")
                return

            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=system,
                tools=_TOOLS,
                messages=messages,
            )

            tool_calls = []
            for block in response.content:
                if block.type == "text" and block.text.strip():
                    emit("text", message=block.text)
                elif block.type == "tool_use":
                    tool_calls.append(block)
                    emit("tool_call", tool=block.name, label=_tool_label(block.name, block.input))

            if response.stop_reason == "end_turn" or not tool_calls:
                emit("done", trip_id=trip_id)
                _set_status(db, prompt_id, "done", trip_id=trip_id)
                return

            messages.append({"role": "assistant", "content": response.content})
            tool_results = []

            for tc in tool_calls:
                if cancel.is_set():
                    emit("cancelled")
                    _set_status(db, prompt_id, "cancelled")
                    return

                try:
                    result = _execute_tool(tc.name, tc.input, base_url, api_token)

                    # Track trip_id the moment a trip is created
                    if tc.name == "create_trip" and isinstance(result, dict) and "id" in result:
                        trip_id = result["id"]
                        _set_trip(db, prompt_id, trip_id)

                    emit("tool_result", tool=tc.name, success=True, summary=_tool_summary(tc.name, result))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tc.id,
                        "content": json.dumps(result),
                    })
                except Exception as exc:
                    msg = str(exc)
                    emit("tool_result", tool=tc.name, success=False, summary=msg)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tc.id,
                        "content": f"Error: {msg}",
                        "is_error": True,
                    })

            messages.append({"role": "user", "content": tool_results})

        emit("error", message=f"Reached the maximum of {max_iterations} iterations. The plan may be incomplete.")
        _set_status(db, prompt_id, "error")

    except Exception as exc:
        emit("error", message=str(exc))
        if db:
            _set_status(db, prompt_id, "error")
    finally:
        if db:
            db.close()
        with _lock:
            _cancel_events.pop(prompt_id, None)
        q.put(None)  # sentinel — tells SSE generator the stream is finished


# ── API routes ────────────────────────────────────────────────────────────────

@ai_bp.route("/plan", methods=["POST"])
def start_plan():
    data = request.json or {}
    user_prompt = (data.get("prompt") or "").strip()
    if not user_prompt:
        return jsonify({"error": "prompt is required"}), 400
    if len(user_prompt) > 2000:
        return jsonify({"error": "Prompt too long (max 2000 characters)"}), 400

    if not Config.ANTHROPIC_API_KEY:
        return jsonify({"error": "ANTHROPIC_API_KEY is not configured on the server"}), 500

    selected_trip_id = data.get("trip_id") or None

    db = get_db()
    try:
        record = AiPrompt(
            prompt_text=user_prompt,
            trip_id=selected_trip_id,
            status="running",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        prompt_id = record.id
    finally:
        db.close()

    model = _select_model(user_prompt)
    q: queue.Queue = queue.Queue()
    cancel = threading.Event()

    with _lock:
        _streams[prompt_id] = q
        _cancel_events[prompt_id] = cancel

    threading.Thread(
        target=_run_agent,
        args=(
            prompt_id, user_prompt, selected_trip_id,
            model, q, cancel,
            Config.FLASK_BASE_URL, Config.API_TOKEN,
            Config.ANTHROPIC_API_KEY, Config.AI_MAX_ITERATIONS,
        ),
        daemon=True,
    ).start()

    return jsonify({"prompt_id": prompt_id, "model": model})


@ai_bp.route("/plan/<int:prompt_id>/stream")
def stream_plan(prompt_id: int):
    def generate():
        with _lock:
            q = _streams.get(prompt_id)

        if q is None:
            # Stream already finished or never existed — check DB for status
            db = get_db()
            try:
                p = db.query(AiPrompt).filter(AiPrompt.id == prompt_id).first()
                if p and p.status in ("done", "cancelled", "error"):
                    yield f"data: {json.dumps({'type': p.status, 'trip_id': p.trip_id})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Stream not found'})}\n\n"
            finally:
                db.close()
            return

        try:
            while True:
                try:
                    event = q.get(timeout=25)
                except queue.Empty:
                    yield ": keepalive\n\n"
                    continue
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            with _lock:
                _streams.pop(prompt_id, None)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@ai_bp.route("/plan/<int:prompt_id>/cancel", methods=["POST"])
def cancel_plan(prompt_id: int):
    with _lock:
        cancel = _cancel_events.get(prompt_id)
    if cancel:
        cancel.set()
        return jsonify({"message": "Cancellation requested"})
    return jsonify({"message": "No active plan found for this ID"}), 404


@ai_bp.route("/prompts")
def list_prompts():
    db = get_db()
    try:
        prompts = (
            db.query(AiPrompt)
            .order_by(AiPrompt.created_at.desc())
            .limit(50)
            .all()
        )
        return jsonify([p.to_dict() for p in prompts])
    finally:
        db.close()


@ai_bp.route("/prompts/<int:prompt_id>", methods=["DELETE"])
def delete_prompt(prompt_id: int):
    db = get_db()
    try:
        p = db.query(AiPrompt).filter(AiPrompt.id == prompt_id).first()
        if not p:
            return jsonify({"error": "Prompt not found"}), 404
        db.delete(p)
        db.commit()
        return jsonify({"message": "Prompt deleted"})
    except Exception as exc:
        db.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        db.close()
