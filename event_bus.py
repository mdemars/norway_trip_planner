"""
In-process event bus for SSE broadcasting.

Each trip gets a list of subscriber queues. When a notify request arrives,
the event is put on every queue. Each SSE endpoint drains its own queue.

This is intentionally single-worker only (no Redis). Run gunicorn with -w 1.
"""

import queue
import threading
from typing import Dict, List

_lock = threading.Lock()
_subscribers: Dict[int, List[queue.Queue]] = {}


def subscribe(trip_id: int) -> queue.Queue:
    """Register a new SSE subscriber for the given trip. Returns its queue."""
    q: queue.Queue = queue.Queue()
    with _lock:
        _subscribers.setdefault(trip_id, []).append(q)
    return q


def unsubscribe(trip_id: int, q: queue.Queue) -> None:
    """Remove a subscriber queue when the client disconnects."""
    with _lock:
        listeners = _subscribers.get(trip_id)
        if listeners:
            try:
                listeners.remove(q)
            except ValueError:
                pass
            if not listeners:
                del _subscribers[trip_id]


def publish(trip_id: int, event: dict) -> None:
    """Broadcast an event dict to all subscribers of the given trip."""
    with _lock:
        listeners = list(_subscribers.get(trip_id, []))
    for q in listeners:
        try:
            q.put_nowait(event)
        except queue.Full:
            pass


def subscriber_count(trip_id: int) -> int:
    """Return the number of active SSE connections for a trip."""
    with _lock:
        return len(_subscribers.get(trip_id, []))
