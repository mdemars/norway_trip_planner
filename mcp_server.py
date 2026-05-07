#!/usr/bin/env python3
"""
MCP Server for Norway Trip Planner
====================================
Exposes Flask API endpoints as MCP tools for Claude, ChatGPT, Gemini,
or any MCP-compatible AI client.

Two transport modes
-------------------
stdio (default) — for Claude Desktop running locally:
    python mcp_server.py

SSE / HTTP — for remote clients (hosted on DigitalOcean or anywhere):
    TRANSPORT=sse python mcp_server.py

Security
--------
- The MCP server authenticates to Flask using API_TOKEN (Bearer header).
- In SSE mode, AI clients must supply MCP_SECRET_KEY as a Bearer token in the
  Authorization header. Requests without a valid key are rejected with 401.
- Use secrets.compare_digest for all token comparisons (timing-safe).

Environment variables (all loaded from .env)
--------------------------------------------
  FLASK_BASE_URL   Base URL of the Flask app  (default: http://localhost:8080)
  API_TOKEN        Secret the MCP server uses to authenticate to Flask
  MCP_SECRET_KEY   Secret AI clients must supply to authenticate to this MCP server
                   (only enforced in SSE mode)
  TRANSPORT        "stdio" or "sse"            (default: stdio)
  MCP_PORT         Port for SSE mode           (default: 8090)
"""

from __future__ import annotations

import os
import secrets
import sys
from datetime import date, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────────────
FLASK_BASE_URL = os.getenv("FLASK_BASE_URL", "http://localhost:8080").rstrip("/")
API_TOKEN = os.getenv("API_TOKEN", "")
MCP_SECRET_KEY = os.getenv("MCP_SECRET_KEY", "")
TRANSPORT = os.getenv("TRANSPORT", "stdio").lower()
MCP_PORT = int(os.getenv("MCP_PORT", "8090"))

if not API_TOKEN:
    print("ERROR: API_TOKEN is not set. Add it to your .env file.", file=sys.stderr)
    sys.exit(1)

if TRANSPORT == "sse" and not MCP_SECRET_KEY:
    print("ERROR: MCP_SECRET_KEY must be set when TRANSPORT=sse.", file=sys.stderr)
    sys.exit(1)


# ── Flask API helpers ──────────────────────────────────────────────────────────
def _headers() -> dict:
    return {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }


def _get(path: str, params: dict | None = None) -> dict | list:
    r = httpx.get(f"{FLASK_BASE_URL}{path}", headers=_headers(), params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def _post(path: str, data: dict) -> dict:
    r = httpx.post(f"{FLASK_BASE_URL}{path}", json=data, headers=_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def _delete(path: str) -> dict:
    r = httpx.delete(f"{FLASK_BASE_URL}{path}", headers=_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


# ── MCP server ─────────────────────────────────────────────────────────────────
mcp = FastMCP(
    "Norway Trip Planner",
    instructions=(
        "You help users plan road trips using the Norway Trip Planner app. "
        "Workflow: (1) validate addresses with validate_address, (2) create the trip, "
        "(3) add stops in order — each stop is automatically appended to the chain, "
        "(4) add activities per stop, "
        "(5) call check_segments after adding each stop to validate the 500 km limit — "
        "this is instant (Haversine, no API quota) and is the correct way to enforce "
        "the distance constraint. Straight-line distance is always shorter than driving "
        "distance, so any segment flagged here will definitely exceed 500 km by road. "
        "If a segment is over 500 km, insert an intermediate stop and re-check. "
        "(6) optionally call check_route for exact driving distances and polylines, "
        "but only after the itinerary is finalised — it uses the Google Maps API. "
        "Return get_trip_url at the end so the user can open the trip in their browser."
    ),
)


# ── Address validation ─────────────────────────────────────────────────────────
@mcp.tool()
def validate_address(address: str) -> dict:
    """
    Validate a place name or address and return its GPS coordinates.
    Call this before adding stops to confirm the location resolves correctly.

    Returns {"valid": true, "latitude": ..., "longitude": ...}
         or {"valid": false, "error": "Address not found"}.
    """
    return _post("/api/validate-address", {"address": address})


# ── Trip tools ─────────────────────────────────────────────────────────────────
@mcp.tool()
def list_trips() -> list:
    """List all existing trips (id, name, stop count, created_at)."""
    return _get("/api/trips")


@mcp.tool()
def get_trip(trip_id: int) -> dict:
    """Get full details of a trip including all stops and activities."""
    return _get(f"/api/trips/{trip_id}")


@mcp.tool()
def create_trip(
    name: str,
    start_address: Optional[str] = None,
    end_address: Optional[str] = None,
) -> dict:
    """
    Create a new empty trip. Returns the trip object including its ID.

    Args:
        name:          Human-readable name, e.g. "Norway Fjords — Summer 2026"
        start_address: Optional origin address (e.g. "Oslo Airport, Norway")
        end_address:   Optional destination address (e.g. "Bergen, Norway")
    """
    payload: dict = {"name": name}
    if start_address:
        payload["start_location_address"] = start_address
    if end_address:
        payload["end_location_address"] = end_address
    return _post("/api/trips", payload)


@mcp.tool()
def delete_trip(trip_id: int) -> dict:
    """Permanently delete a trip and all its stops and activities."""
    return _delete(f"/api/trips/{trip_id}")


# ── Stop tools ─────────────────────────────────────────────────────────────────
@mcp.tool()
def get_stops(trip_id: int) -> list:
    """Return all stops for a trip in chain order, each with their activities."""
    return _get(f"/api/trips/{trip_id}/stops")


@mcp.tool()
def add_stop(
    trip_id: int,
    name: str,
    address: str,
    start_date: Optional[str] = None,
    nights: Optional[int] = None,
    description: Optional[str] = None,
) -> dict:
    """
    Add a stop to a trip. Stops are appended to the end of the chain automatically.

    Args:
        trip_id:     ID of the trip (from create_trip)
        name:        Display name of the stop, e.g. "Bergen"
        address:     Full address or well-known place name, e.g. "Bergen, Norway"
        start_date:  Arrival date in YYYY-MM-DD format (optional)
        nights:      Number of nights — combined with start_date to set end_date (optional)
        description: Notes about the stop, e.g. "Base for fjord hikes" (optional)

    Returns the created stop object including its ID (needed for add_activity).
    """
    payload: dict = {
        "name": name,
        "location_type": "address",
        "address": address,
    }
    if description:
        payload["description"] = description
    if start_date:
        payload["start_date"] = start_date
        if nights is not None:
            end = date.fromisoformat(start_date) + timedelta(days=nights)
            payload["end_date"] = end.isoformat()
    return _post(f"/api/trips/{trip_id}/stops", payload)


@mcp.tool()
def delete_stop(stop_id: int) -> dict:
    """Delete a stop (and all its activities) from its trip."""
    return _delete(f"/api/stops/{stop_id}")


@mcp.tool()
def reorder_stops(trip_id: int, stop_ids: list[int]) -> dict:
    """
    Reorder the stops of a trip by supplying the desired stop ID sequence.

    Use this when stops end up in the wrong order — for example after inserting
    a stop that should appear earlier in the itinerary, or to sort stops by date.

    Args:
        trip_id:  ID of the trip
        stop_ids: Complete list of stop IDs in the desired new order.
                  Every stop that belongs to the trip must be included;
                  omitting a stop will cause it to be detached from the chain.

    Call get_stops(trip_id) first to retrieve the current IDs and order.
    After reordering, call check_segments to re-validate driving distances.
    """
    return _post(f"/api/trips/{trip_id}/reorder", {"stop_ids": stop_ids})


# ── Activity tools ─────────────────────────────────────────────────────────────
@mcp.tool()
def add_activity(
    stop_id: int,
    name: str,
    description: Optional[str] = None,
    url: Optional[str] = None,
) -> dict:
    """
    Add an activity to a stop.

    Args:
        stop_id:     ID of the stop (from add_stop)
        name:        Activity name, e.g. "Hike to Pulpit Rock (Preikestolen)"
        description: Details, duration, difficulty, etc. (optional)
        url:         Booking page, trail map, or reference URL (optional)
    """
    payload: dict = {"name": name}
    if description:
        payload["description"] = description
    if url:
        payload["url"] = url
    return _post(f"/api/stops/{stop_id}/activities", payload)


# ── Bookmark tools ────────────────────────────────────────────────────────────
@mcp.tool()
def get_bookmarks(trip_id: int) -> list:
    """List all bookmarks saved on a trip (reference URLs with optional descriptions)."""
    return _get(f"/api/trips/{trip_id}/bookmarks")


@mcp.tool()
def add_bookmark(trip_id: int, url: str, description: Optional[str] = None) -> dict:
    """
    Save a reference URL as a bookmark on a trip.

    Useful for attaching research links — campsite listings, attraction pages,
    ferry schedules, travel blogs, etc. — so they appear in the trip's bookmark tab.

    Args:
        trip_id:     ID of the trip
        url:         Full URL to bookmark (e.g. "https://www.visitnorway.com/...")
        description: Short label describing the link (optional)
    """
    payload: dict = {"url": url}
    if description:
        payload["description"] = description
    return _post(f"/api/trips/{trip_id}/bookmarks", payload)


@mcp.tool()
def delete_bookmark(bookmark_id: int) -> dict:
    """Delete a bookmark by its ID."""
    return _delete(f"/api/bookmarks/{bookmark_id}")


# ── Route / distance tools ─────────────────────────────────────────────────────

@mcp.tool()
def check_segments(trip_id: int, max_km: float = 500) -> dict:
    """
    Fast straight-line distance check between consecutive stops using the Haversine
    formula on stored coordinates. No external API call — responds in milliseconds.

    THIS IS THE CORRECT TOOL for validating the maximum distance between stops.
    Call it after every add_stop to catch over-limit legs immediately.

    Straight-line distances are always shorter than actual driving distances, so:
    - A segment flagged here WILL exceed max_km by road — insert an intermediate stop.
    - A segment not flagged here is very likely safe by road as well.

    For exact driving distances with turn-by-turn routing, use check_route instead
    (that tool calls Google Maps and counts against your API quota — use sparingly).

    Args:
        trip_id: ID of the trip
        max_km:  Maximum allowed straight-line distance per segment in km (default 500)

    Returns:
        segments  — list of {from_name, to_name, to_guid, distance_km, over_500km}
        warnings  — human-readable warnings for every segment that exceeds max_km
        all_ok    — true when every segment is within max_km
    """
    return _get(f"/api/trips/{trip_id}/segments", params={"max_km": max_km})


@mcp.tool()
def check_route(trip_id: int, max_km: float = 500) -> dict:
    """
    Calculate the full driving route via Google Maps and return per-segment driving
    distances, durations, and polyline data.

    Use check_segments instead for distance limit validation — it is instant and uses
    no API quota. Use this tool only when you need exact driving distances or want
    to draw the route on the map (typically after the itinerary is finalised).

    Args:
        trip_id: ID of the trip
        max_km:  Maximum allowed driving distance per segment in km (default 500)

    Returns:
        total_distance_km  — total driving distance for the full trip
        segments           — list of {from_name, to_name, distance_km, duration_text,
                             distance_text, polyline, over_limit}
        warnings           — over-limit segments (should be none if check_segments passed)
        all_segments_ok    — true when every driving segment is within max_km
    """
    data = _get(f"/api/trips/{trip_id}/route")

    segments = data.get("segments", [])
    total_km = data.get("total_distance_km", 0)

    warnings: list[str] = []
    annotated: list[dict] = []
    for seg in segments:
        dist = seg.get("distance_km") or 0
        over = dist > max_km
        annotated.append({**seg, "over_limit": over})
        if over:
            warnings.append(
                f"WARNING: {seg.get('from_name', '?')} -> {seg.get('to_name', '?')}: "
                f"{dist:.0f} km exceeds the {max_km:.0f} km limit — add an intermediate stop."
            )

    return {
        "total_distance_km": total_km,
        "segments": annotated,
        "warnings": warnings,
        "all_segments_ok": len(warnings) == 0,
    }


@mcp.tool()
def get_trip_url(trip_id: int) -> str:
    """Return the browser URL for viewing and editing the trip in the web app."""
    return f"{FLASK_BASE_URL}/trip/{trip_id}"


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if TRANSPORT == "sse":
        # HTTP/SSE mode — suitable for remote hosting.
        # Only clients that supply the correct MCP_SECRET_KEY Bearer token can connect.
        import uvicorn
        from starlette.middleware import Middleware
        from starlette.middleware.base import BaseHTTPMiddleware
        from starlette.responses import Response

        class _BearerAuthMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                # Health check — no auth required
                if request.url.path == "/health":
                    return await call_next(request)
                auth = request.headers.get("Authorization", "")
                if not auth.startswith("Bearer "):
                    return Response("Unauthorized — Bearer token required", status_code=401)
                if not secrets.compare_digest(auth[7:], MCP_SECRET_KEY):
                    return Response("Unauthorized — invalid MCP secret key", status_code=401)
                return await call_next(request)

        asgi_app = mcp.http_app(
            transport="sse",
            middleware=[Middleware(_BearerAuthMiddleware)],
        )
        print(f"MCP server (SSE) listening on port {MCP_PORT}", file=sys.stderr)
        uvicorn.run(asgi_app, host="0.0.0.0", port=MCP_PORT)
    else:
        # stdio mode — default, used by Claude Desktop running locally.
        # No network exposure; security comes from OS process isolation.
        mcp.run()
