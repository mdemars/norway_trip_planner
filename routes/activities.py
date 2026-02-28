from flask import Blueprint, request, jsonify
from models import Stop, Activity, get_db

activities_bp = Blueprint('activities', __name__, url_prefix='/api')


@activities_bp.route('/stops/<int:stop_id>/activities', methods=['POST'])
def create_activity(stop_id):
    """Create a new activity"""
    data = request.json

    if not data.get('name'):
        return jsonify({'error': 'Activity name is required'}), 400

    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404

        activity = Activity(
            stop_id=stop_id,
            name=data['name'],
            description=data.get('description', ''),
            url=data.get('url', '')
        )

        db.add(activity)
        db.commit()
        db.refresh(activity)
        return jsonify(activity.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@activities_bp.route('/activities/<int:activity_id>', methods=['PUT'])
def update_activity(activity_id):
    """Update an activity"""
    data = request.json

    db = get_db()
    try:
        activity = db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404

        if 'name' in data:
            activity.name = data['name']
        if 'description' in data:
            activity.description = data['description']
        if 'url' in data:
            activity.url = data['url']

        db.commit()
        db.refresh(activity)
        return jsonify(activity.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@activities_bp.route('/activities/<int:activity_id>', methods=['DELETE'])
def delete_activity(activity_id):
    """Delete an activity"""
    db = get_db()
    try:
        activity = db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404

        db.delete(activity)
        db.commit()
        return jsonify({'message': 'Activity deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
