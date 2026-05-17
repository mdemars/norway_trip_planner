import io
import urllib.request
from flask import Blueprint, request, jsonify, Response
from models import Stop, Activity, Photo, get_db

photos_bp = Blueprint('photos', __name__, url_prefix='/api')

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
MAX_DIMENSION = 1920


def _resize_image(data, content_type):
    """Resize image to at most MAX_DIMENSION px on the longest side. Falls back silently."""
    try:
        from PIL import Image, ImageOps
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # fix orientation from EXIF
        if max(img.size) > MAX_DIMENSION:
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
        if content_type in ('image/heic', 'image/heif'):
            content_type = 'image/jpeg'
        fmt_map = {
            'image/jpeg': 'JPEG',
            'image/png': 'PNG',
            'image/gif': 'GIF',
            'image/webp': 'WEBP',
        }
        fmt = fmt_map.get(content_type, 'JPEG')
        if fmt == 'JPEG' and img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        out = io.BytesIO()
        save_kwargs = {'quality': 85, 'optimize': True} if fmt == 'JPEG' else {}
        img.save(out, format=fmt, **save_kwargs)
        return out.getvalue(), content_type
    except Exception:
        return data, content_type


def _handle_upload(file):
    """Validate and process an uploaded file. Returns (data, content_type) or raises ValueError."""
    if not file or file.filename == '':
        raise ValueError('No file selected')
    data = file.read()
    if len(data) > MAX_FILE_SIZE:
        raise ValueError('File too large (max 15 MB)')
    content_type = file.content_type or 'image/jpeg'
    if content_type not in ALLOWED_TYPES:
        raise ValueError('Invalid file type — only images are allowed')
    return _resize_image(data, content_type)


def _fetch_url(url):
    """Download an image from a URL. Returns (data, content_type, filename) or raises ValueError."""
    if not url or not url.startswith(('http://', 'https://')):
        raise ValueError('A valid http(s) URL is required')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read(MAX_FILE_SIZE + 1)
            if len(raw) > MAX_FILE_SIZE:
                raise ValueError('Remote image too large (max 15 MB)')
            content_type = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0].strip()
    except urllib.error.URLError as e:
        raise ValueError(f'Could not fetch image: {e.reason}')
    if content_type not in ALLOWED_TYPES:
        content_type = 'image/jpeg'  # assume JPEG for unknown types
    filename = url.split('?')[0].rstrip('/').split('/')[-1] or 'image'
    if '.' not in filename:
        filename += '.jpg'
    data, content_type = _resize_image(raw, content_type)
    return data, content_type, filename


@photos_bp.route('/stops/<int:stop_id>/photos', methods=['POST'])
def upload_stop_photo(stop_id):
    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404
        if 'photo' not in request.files:
            return jsonify({'error': 'No photo file provided'}), 400
        try:
            data, content_type = _handle_upload(request.files['photo'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        photo = Photo(
            stop_id=stop_id,
            filename=request.files['photo'].filename,
            content_type=content_type,
            data=data,
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)
        return jsonify(photo.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@photos_bp.route('/stops/<int:stop_id>/photos/from-url', methods=['POST'])
def upload_stop_photo_from_url(stop_id):
    db = get_db()
    try:
        stop = db.query(Stop).filter(Stop.id == stop_id).first()
        if not stop:
            return jsonify({'error': 'Stop not found'}), 404
        url = (request.json or {}).get('url', '').strip()
        try:
            data, content_type, filename = _fetch_url(url)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        photo = Photo(stop_id=stop_id, filename=filename, content_type=content_type, data=data)
        db.add(photo)
        db.commit()
        db.refresh(photo)
        return jsonify(photo.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@photos_bp.route('/activities/<int:activity_id>/photos', methods=['POST'])
def upload_activity_photo(activity_id):
    db = get_db()
    try:
        activity = db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404
        if 'photo' not in request.files:
            return jsonify({'error': 'No photo file provided'}), 400
        try:
            data, content_type = _handle_upload(request.files['photo'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        photo = Photo(
            activity_id=activity_id,
            filename=request.files['photo'].filename,
            content_type=content_type,
            data=data,
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)
        return jsonify(photo.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@photos_bp.route('/activities/<int:activity_id>/photos/from-url', methods=['POST'])
def upload_activity_photo_from_url(activity_id):
    db = get_db()
    try:
        activity = db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404
        url = (request.json or {}).get('url', '').strip()
        try:
            data, content_type, filename = _fetch_url(url)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        photo = Photo(activity_id=activity_id, filename=filename, content_type=content_type, data=data)
        db.add(photo)
        db.commit()
        db.refresh(photo)
        return jsonify(photo.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@photos_bp.route('/photos/<int:photo_id>', methods=['GET'])
def get_photo(photo_id):
    db = get_db()
    try:
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        if not photo:
            return jsonify({'error': 'Photo not found'}), 404
        return Response(
            photo.data,
            mimetype=photo.content_type,
            headers={'Cache-Control': 'public, max-age=86400'},
        )
    finally:
        db.close()


@photos_bp.route('/photos/<int:photo_id>', methods=['PATCH'])
def update_photo(photo_id):
    db = get_db()
    try:
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        if not photo:
            return jsonify({'error': 'Photo not found'}), 404
        data = request.json or {}
        if 'caption' in data:
            photo.caption = data['caption'].strip() or None
        db.commit()
        db.refresh(photo)
        return jsonify(photo.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@photos_bp.route('/photos/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    db = get_db()
    try:
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        if not photo:
            return jsonify({'error': 'Photo not found'}), 404
        db.delete(photo)
        db.commit()
        return jsonify({'message': 'Photo deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
