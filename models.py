from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from config import Config

Base = declarative_base()

class Trip(Base):
    """Trip model representing a complete journey"""
    __tablename__ = 'trips'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    stops = relationship('Stop', back_populates='trip', cascade='all, delete-orphan', order_by='Stop.start_date')
    
    def to_dict(self, include_stops=False):
        """Convert trip to dictionary"""
        data = {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_stops:
            data['stops'] = [stop.to_dict(include_activities=True) for stop in self.stops]
        return data


class Stop(Base):
    """Stop model representing a location in a trip"""
    __tablename__ = 'stops'
    
    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey('trips.id'), nullable=False)
    name = Column(String(200), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    location_type = Column(String(20), nullable=False)  # 'gps' or 'address'
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String(500))
    order_index = Column(Integer, nullable=False, default=0)
    
    # Relationships
    trip = relationship('Trip', back_populates='stops')
    activities = relationship('Activity', back_populates='stop', cascade='all, delete-orphan')
    
    def to_dict(self, include_activities=False):
        """Convert stop to dictionary"""
        data = {
            'id': self.id,
            'trip_id': self.trip_id,
            'name': self.name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'location_type': self.location_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'order_index': self.order_index
        }
        if include_activities:
            data['activities'] = [activity.to_dict() for activity in self.activities]
        return data


class Activity(Base):
    """Activity model representing things to do at a stop"""
    __tablename__ = 'activities'

    id = Column(Integer, primary_key=True)
    stop_id = Column(Integer, ForeignKey('stops.id'), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    url = Column(String(500))

    # Relationships
    stop = relationship('Stop', back_populates='activities')

    def to_dict(self):
        """Convert activity to dictionary"""
        return {
            'id': self.id,
            'stop_id': self.stop_id,
            'name': self.name,
            'description': self.description,
            'url': self.url
        }


class Waypoint(Base):
    """Waypoint model representing intermediate points along the route"""
    __tablename__ = 'waypoints'

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey('trips.id'), nullable=False)
    name = Column(String(200), nullable=False)
    order_index = Column(Float, nullable=False)  # Float to allow insertion between stops
    location_type = Column(String(20), nullable=False)  # 'gps' or 'address'
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String(500))

    # Relationships
    trip = relationship('Trip', backref='waypoints')

    def to_dict(self):
        """Convert waypoint to dictionary"""
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'name': self.name,
            'order_index': self.order_index,
            'location_type': self.location_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'address': self.address,
            'type': 'waypoint'  # To distinguish from stops in UI
        }


# Database setup
engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    """Initialize the database"""
    Base.metadata.create_all(engine)
    print("Database initialized successfully!")

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Session will be closed by caller
