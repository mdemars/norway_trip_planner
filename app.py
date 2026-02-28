from flask import Flask, request, jsonify, session, redirect
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
from config import Config
from models import init_db
from werkzeug.middleware.proxy_fix import ProxyFix


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    CORS(app, supports_credentials=True)

    Config.validate()
    init_db()

    # OAuth setup
    oauth = OAuth(app)
    app.extensions['google_oauth'] = oauth.register(
        name='google',
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )
    app.extensions['microsoft_oauth'] = oauth.register(
        name='microsoft',
        client_id=Config.MICROSOFT_CLIENT_ID,
        client_secret=Config.MICROSOFT_CLIENT_SECRET,
        server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

    # App-wide middleware
    @app.context_processor
    def inject_user():
        """Make user session data available in all templates"""
        return {
            'user_email': session.get('user_email'),
            'user_name': session.get('user_name'),
            'user_picture': session.get('user_picture')
        }

    @app.before_request
    def require_login():
        """Require authentication for all routes except auth-related ones"""
        allowed_prefixes = ('/login', '/auth/', '/logout', '/favicon.ico', '/static/')
        if any(request.path.startswith(p) for p in allowed_prefixes):
            return
        if not session.get('user_email'):
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect('/login')

    # Register blueprints
    from routes.auth import auth_bp
    from routes.web import web_bp
    from routes.trips import trips_bp
    from routes.stops import stops_bp
    from routes.activities import activities_bp
    from routes.waypoints import waypoints_bp
    from routes.routing import routing_bp
    from routes.admin import admin_bp
    from routes.backups import backups_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(web_bp)
    app.register_blueprint(trips_bp)
    app.register_blueprint(stops_bp)
    app.register_blueprint(activities_bp)
    app.register_blueprint(waypoints_bp)
    app.register_blueprint(routing_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(backups_bp)

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=8080, debug=Config.DEBUG)
