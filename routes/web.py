from flask import Blueprint, render_template, send_from_directory, current_app
from config import Config
import os

web_bp = Blueprint('web', __name__)


@web_bp.route('/')
def index():
    """Home page - list of all trips"""
    return render_template('index.html')


@web_bp.route('/trip/<int:trip_id>')
def trip_detail(trip_id):
    """Trip detail page"""
    return render_template('trip_detail.html', trip_id=trip_id, config=Config)


@web_bp.route('/backups')
def backups():
    """Backups management page"""
    return render_template('backups.html')


@web_bp.route('/favicon.ico')
def favicon():
    """Serve favicon"""
    return send_from_directory(
        os.path.join(current_app.root_path, 'static', 'images'),
        'campervan.png',
        mimetype='image/png'
    )
