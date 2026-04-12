from flask import Blueprint, request, jsonify
from models import TripBookmark, Trip, get_db

bookmarks_bp = Blueprint('bookmarks', __name__, url_prefix='/api')


@bookmarks_bp.route('/trips/<int:trip_id>/bookmarks', methods=['GET'])
def get_bookmarks(trip_id):
    db = get_db()
    try:
        bookmarks = db.query(TripBookmark).filter(TripBookmark.trip_id == trip_id).all()
        return jsonify([b.to_dict() for b in bookmarks])
    finally:
        db.close()


@bookmarks_bp.route('/trips/<int:trip_id>/bookmarks', methods=['POST'])
def create_bookmark(trip_id):
    data = request.json
    url = (data.get('url') or '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        bookmark = TripBookmark(
            trip_id=trip_id,
            url=url,
            description=(data.get('description') or '').strip() or None,
        )
        db.add(bookmark)
        db.commit()
        db.refresh(bookmark)
        return jsonify(bookmark.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@bookmarks_bp.route('/bookmarks/<int:bookmark_id>', methods=['DELETE'])
def delete_bookmark(bookmark_id):
    db = get_db()
    try:
        bookmark = db.query(TripBookmark).filter(TripBookmark.id == bookmark_id).first()
        if not bookmark:
            return jsonify({'error': 'Bookmark not found'}), 404
        db.delete(bookmark)
        db.commit()
        return jsonify({'message': 'Bookmark deleted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
