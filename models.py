from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, text, inspect
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from config import Config
import uuid

Base = declarative_base()

class Trip(Base):
    """Trip model representing a complete journey"""
    __tablename__ = 'trips'

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Start location
    start_location_address = Column(String(500))
    start_location_latitude = Column(Float)
    start_location_longitude = Column(Float)

    # End location
    end_location_address = Column(String(500))
    end_location_latitude = Column(Float)
    end_location_longitude = Column(Float)

    # Relationships
    stops = relationship('Stop', back_populates='trip', cascade='all, delete-orphan', order_by='Location.start_date')

    def to_dict(self, include_stops=False):
        """Convert trip to dictionary"""
        data = {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'start_location': {
                'address': self.start_location_address,
                'latitude': self.start_location_latitude,
                'longitude': self.start_location_longitude
            } if self.start_location_address else None,
            'end_location': {
                'address': self.end_location_address,
                'latitude': self.end_location_latitude,
                'longitude': self.end_location_longitude
            } if self.end_location_address else None
        }
        if include_stops:
            data['stops'] = [stop.to_dict(include_activities=True) for stop in self.stops]
        return data


class Location(Base):
    """Base class for Stop and Waypoint - represents a location in a trip"""
    __tablename__ = 'locations'

    id = Column(Integer, primary_key=True)
    guid = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    trip_id = Column(Integer, ForeignKey('trips.id'), nullable=False)
    name = Column(String(200), nullable=False)
    location_type = Column(String(20), nullable=False)  # 'gps' or 'address'
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String(500))
    previous_location_guid = Column(String(36), ForeignKey('locations.guid'), nullable=True)
    type = Column(String(20))  # 'stop' or 'waypoint' - for polymorphism

    # Stop-specific fields (nullable, only used when type='stop')
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    # Relationships
    trip = relationship('Trip', foreign_keys=[trip_id],
                        overlaps='stops,trip', backref=None)
    # Trip.locations is defined via backref-free access; use Trip.stops for stops
    previous_location = relationship('Location', remote_side=[guid], backref='next_locations')

    __mapper_args__ = {
        'polymorphic_identity': 'location',
        'polymorphic_on': type
    }


class Stop(Location):
    """Stop model representing a location in a trip with dates"""

    # Relationships
    trip = relationship('Trip', back_populates='stops', foreign_keys=[Location.trip_id],
                        overlaps='locations,trip')
    activities = relationship('Activity', back_populates='stop', cascade='all, delete-orphan',
                              foreign_keys='Activity.stop_id')

    __mapper_args__ = {
        'polymorphic_identity': 'stop',
    }

    def to_dict(self, include_activities=False):
        """Convert stop to dictionary"""
        data = {
            'id': self.id,
            'guid': self.guid,
            'trip_id': self.trip_id,
            'name': self.name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'location_type': self.location_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'previous_location_guid': self.previous_location_guid,
            'type': 'stop'
        }
        if include_activities:
            data['activities'] = [activity.to_dict() for activity in self.activities]
        return data


class Activity(Base):
    """Activity model representing things to do at a stop"""
    __tablename__ = 'activities'

    id = Column(Integer, primary_key=True)
    stop_id = Column(Integer, ForeignKey('locations.id'), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    url = Column(String(500))

    # Relationships
    stop = relationship('Stop', back_populates='activities', foreign_keys=[stop_id])

    def to_dict(self):
        """Convert activity to dictionary"""
        return {
            'id': self.id,
            'stop_id': self.stop_id,
            'name': self.name,
            'description': self.description,
            'url': self.url
        }


class Waypoint(Location):
    """Waypoint model representing intermediate points along the route"""

    __mapper_args__ = {
        'polymorphic_identity': 'waypoint',
    }

    def to_dict(self):
        """Convert waypoint to dictionary"""
        return {
            'id': self.id,
            'guid': self.guid,
            'trip_id': self.trip_id,
            'name': self.name,
            'location_type': self.location_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'previous_location_guid': self.previous_location_guid,
            'type': 'waypoint'
        }


# Database setup
engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(bind=engine)


def _migrate_to_single_table(engine):
    """One-time migration: merge stops/waypoints tables into locations."""
    insp = inspect(engine)
    existing_tables = insp.get_table_names()

    # Only run if old 'stops' table still exists
    if 'stops' not in existing_tables:
        return

    print("Migrating from joined-table to single-table inheritance...")
    with engine.connect() as conn:
        # Add start_date and end_date columns to locations if missing
        location_cols = [c['name'] for c in insp.get_columns('locations')]
        if 'start_date' not in location_cols:
            conn.execute(text("ALTER TABLE locations ADD COLUMN start_date DATETIME"))
        if 'end_date' not in location_cols:
            conn.execute(text("ALTER TABLE locations ADD COLUMN end_date DATETIME"))

        # Copy dates from stops into locations
        conn.execute(text("""
            UPDATE locations
            SET start_date = (SELECT s.start_date FROM stops s WHERE s.id = locations.id),
                end_date = (SELECT s.end_date FROM stops s WHERE s.id = locations.id)
            WHERE locations.id IN (SELECT s.id FROM stops s)
        """))

        # Update activities FK: the IDs are the same, just pointing at a different table
        # SQLite doesn't enforce FK constraints by default so just leave the data as-is

        # Drop old child tables
        conn.execute(text("DROP TABLE IF EXISTS stops"))
        conn.execute(text("DROP TABLE IF EXISTS waypoints"))
        conn.commit()

    print("Migration complete.")


def init_db():
    """Initialize the database"""
    _migrate_to_single_table(engine)
    Base.metadata.create_all(engine)
    print("Database initialized successfully!")

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Session will be closed by caller
