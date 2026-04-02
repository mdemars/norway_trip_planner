"""
Pytest configuration and shared fixtures for the Norway Trip Planner test suite.
"""
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, TRIPS_SCHEMA


@pytest.fixture(scope='session')
def mock_services():
    """Patch geocoding and route services before the app is imported."""
    geocoding_mock = MagicMock()
    geocoding_mock.geocode_address.return_value = None
    geocoding_mock.reverse_geocode.return_value = None

    route_mock = MagicMock()
    route_mock.calculate_route.return_value = {
        'total_distance_km': 0,
        'segments': []
    }

    with patch('services.geocoding_service', geocoding_mock), \
         patch('services.route_service', route_mock), \
         patch('helpers.geocoding_service', geocoding_mock):
        yield geocoding_mock, route_mock


@pytest.fixture()
def app(mock_services, tmp_path):
    """Create a test Flask app backed by an in-memory SQLite database."""
    import os
    os.environ.setdefault('FLASK_SECRET_KEY', 'test-secret')
    os.environ.setdefault('GOOGLE_CLIENT_ID', 'test')
    os.environ.setdefault('GOOGLE_CLIENT_SECRET', 'test')
    os.environ.setdefault('MICROSOFT_CLIENT_ID', 'test')
    os.environ.setdefault('MICROSOFT_CLIENT_SECRET', 'test')

    db_path = tmp_path / 'test.db'
    db_uri = f'sqlite:///{db_path}'

    # SQLite doesn't support named schemas; attach a second file as "public"
    # so that "public.trips" etc. resolve correctly.
    public_db_path = tmp_path / 'public.db'

    from sqlalchemy import event as sa_event

    test_engine = create_engine(db_uri, connect_args={'check_same_thread': False})

    @sa_event.listens_for(test_engine, 'connect')
    def attach_public_schema(dbapi_conn, _record):
        dbapi_conn.execute(f"ATTACH DATABASE '{public_db_path}' AS public")

    Base.metadata.create_all(test_engine)
    TestSession = sessionmaker(bind=test_engine)

    with patch('models.engine', test_engine), \
         patch('models.SessionLocal', TestSession), \
         patch('config.Config.SQLALCHEMY_DATABASE_URI', db_uri), \
         patch('config.Config.validate'), \
         patch('models.init_db'):  # skip migration logic; tables already created above
        from app import create_app
        flask_app = create_app()
        flask_app.config['TESTING'] = True
        flask_app.config['SECRET_KEY'] = 'test-secret'

        yield flask_app


@pytest.fixture()
def client(app):
    """Flask test client with a pre-authenticated session."""
    with app.test_client() as c:
        with c.session_transaction() as sess:
            sess['user_email'] = 'test@example.com'
            sess['user_name'] = 'Test User'
        yield c
