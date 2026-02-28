from flask import Blueprint, request, jsonify, render_template
from datetime import datetime
from models import Trip, Location, Activity, get_db
from sqlalchemy import inspect as sa_inspect

admin_bp = Blueprint('admin', __name__)

ADMIN_MODELS = {
    'trip': Trip,
    'location': Location,
    'activity': Activity,
}


@admin_bp.route('/admin')
def admin():
    """Admin page - CRUD for all entities"""
    return render_template('admin.html')


@admin_bp.route('/api/admin/entities', methods=['GET'])
def get_entity_types():
    """Get all available entity types and their column names"""
    result = {}
    for name, model in ADMIN_MODELS.items():
        mapper = sa_inspect(model)
        columns = [col.key for col in mapper.column_attrs]
        result[name] = columns
    return jsonify(result)


@admin_bp.route('/api/admin/<entity_type>', methods=['GET'])
def get_all_entities(entity_type):
    """Get all instances of a given entity type"""
    model = ADMIN_MODELS.get(entity_type)
    if not model:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 400

    db = get_db()
    try:
        mapper = sa_inspect(model)
        columns = [col.key for col in mapper.column_attrs]
        items = db.query(model).all()
        result = []
        for item in items:
            row = {}
            for col in columns:
                val = getattr(item, col, None)
                if isinstance(val, datetime):
                    val = val.isoformat()
                row[col] = val
            result.append(row)
        return jsonify({'columns': columns, 'rows': result})
    finally:
        db.close()


@admin_bp.route('/api/admin/<entity_type>/<int:entity_id>', methods=['DELETE'])
def delete_entity(entity_type, entity_id):
    """Delete an entity by type and ID"""
    model = ADMIN_MODELS.get(entity_type)
    if not model:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 400

    db = get_db()
    try:
        item = db.query(model).filter(model.id == entity_id).first()
        if not item:
            return jsonify({'error': f'{entity_type} with id {entity_id} not found'}), 404
        db.delete(item)
        db.commit()
        return jsonify({'message': f'{entity_type} {entity_id} deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
