"""
Presence blueprint — real-time collaborative editing notifications via SSE.

GET  /api/trips/<id>/events   — open SSE stream (one per browser tab)
POST /api/trips/<id>/notify   — broadcast an edit event to other viewers
"""

import json
import time
from flask import Blueprint, Response, request, session, stream_with_context
from event_bus import subscribe, unsubscribe, publish, subscriber_count

presence_bp = Blueprint('presence_bp', __name__)

# How often (seconds) to send a keep-alive comment to prevent proxy timeouts
_HEARTBEAT_INTERVAL = 25


@presence_bp.route('/api/trips/<int:trip_id>/events')
def trip_events(trip_id):
    """SSE endpoint — streams events to a connected client."""
    user_name = session.get('user_name', 'Someone')

    def generate():
        q = subscribe(trip_id)
        try:
            # Announce arrival to other viewers
            publish(trip_id, {
                'action': 'joined',
                'user': user_name,
                'viewers': subscriber_count(trip_id),
            })

            last_heartbeat = time.time()

            while True:
                # Block for up to HEARTBEAT_INTERVAL seconds waiting for an event
                try:
                    event = q.get(timeout=_HEARTBEAT_INTERVAL)
                    yield f'data: {json.dumps(event)}\n\n'
                except Exception:
                    # Timeout — send a keep-alive comment
                    yield ': ping\n\n'
                    last_heartbeat = time.time()

        except GeneratorExit:
            pass
        finally:
            unsubscribe(trip_id, q)
            # Announce departure
            publish(trip_id, {
                'action': 'left',
                'user': user_name,
                'viewers': subscriber_count(trip_id),
            })

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',  # Disable Nginx buffering
        }
    )


@presence_bp.route('/api/trips/<int:trip_id>/notify', methods=['POST'])
def notify(trip_id):
    """Publish an edit event to all SSE subscribers of this trip."""
    data = request.get_json(silent=True) or {}
    action = data.get('action')
    entity = data.get('entity')
    entity_id = data.get('entity_id')
    entity_name = data.get('entity_name', '')

    if action not in ('editing', 'saved', 'deleted', 'added'):
        return {'error': 'Invalid action'}, 400
    if entity not in ('stop', 'activity'):
        return {'error': 'Invalid entity'}, 400

    user_name = session.get('user_name', 'Someone')

    publish(trip_id, {
        'action': action,
        'entity': entity,
        'entity_id': entity_id,
        'entity_name': entity_name,
        'user': user_name,
    })

    return '', 204
