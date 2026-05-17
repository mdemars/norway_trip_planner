from flask import Blueprint, send_file, jsonify, request
from models import Trip, TripBookmark, get_db
from helpers import get_ordered_locations
from config import Config
from export_helpers import generate_excel, generate_word, generate_pdf
import re

export_bp = Blueprint('export', __name__, url_prefix='/api')


def _safe_filename(name):
    """Sanitise a trip name for use in a filename."""
    return re.sub(r'[^\w\- ]', '', name).strip().replace(' ', '_') or 'trip'


@export_bp.route('/trips/<int:trip_id>/export/xlsx', methods=['GET'])
def export_xlsx(trip_id):
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        stops = [s for s in get_ordered_locations(db, trip_id)
                 if hasattr(s, 'activities')]
        bookmarks = db.query(TripBookmark).filter(TripBookmark.trip_id == trip_id).all()

        lang = request.args.get('lang', 'en')
        buf = generate_excel(trip, stops, bookmarks, lang=lang)
        filename = f'{_safe_filename(trip.name)}.xlsx'
        return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         as_attachment=True, download_name=filename)
    finally:
        db.close()


@export_bp.route('/trips/<int:trip_id>/export/docx', methods=['GET'])
def export_docx(trip_id):
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        stops = [s for s in get_ordered_locations(db, trip_id)
                 if hasattr(s, 'activities')]
        bookmarks = db.query(TripBookmark).filter(TripBookmark.trip_id == trip_id).all()

        lang = request.args.get('lang', 'en')
        buf = generate_word(trip, stops, bookmarks, api_key=Config.GOOGLE_MAPS_API_KEY, lang=lang)
        filename = f'{_safe_filename(trip.name)}.docx'
        return send_file(buf,
                         mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         as_attachment=True, download_name=filename)
    finally:
        db.close()


@export_bp.route('/trips/<int:trip_id>/export/pdf', methods=['GET'])
def export_pdf(trip_id):
    db = get_db()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        stops = [s for s in get_ordered_locations(db, trip_id)
                 if hasattr(s, 'activities')]
        bookmarks = db.query(TripBookmark).filter(TripBookmark.trip_id == trip_id).all()

        lang = request.args.get('lang', 'en')
        buf = generate_pdf(trip, stops, bookmarks, api_key=Config.GOOGLE_MAPS_API_KEY, lang=lang)
        filename = f'{_safe_filename(trip.name)}.pdf'
        return send_file(buf, mimetype='application/pdf',
                         as_attachment=True, download_name=filename)
    finally:
        db.close()
