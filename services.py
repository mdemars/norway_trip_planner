import googlemaps
from geopy.geocoders import Nominatim
from config import Config
from typing import Optional, Tuple, List, Dict

class GeocodingService:
    """Service for converting addresses to coordinates"""
    
    def __init__(self):
        self.geolocator = Nominatim(user_agent="trip-planner")
    
    def geocode_address(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Convert address to GPS coordinates
        Returns: (latitude, longitude) or None if not found
        """
        try:
            location = self.geolocator.geocode(address)
            if location:
                return (location.latitude, location.longitude)
            return None
        except Exception as e:
            print(f"Geocoding error: {e}")
            return None
    
    def reverse_geocode(self, latitude: float, longitude: float) -> Optional[str]:
        """
        Convert GPS coordinates to address
        Returns: address string or None if not found
        """
        try:
            location = self.geolocator.reverse(f"{latitude}, {longitude}")
            if location:
                return location.address
            return None
        except Exception as e:
            print(f"Reverse geocoding error: {e}")
            return None


class RouteService:
    """Service for calculating routes and distances using Google Maps"""
    
    def __init__(self):
        self.api_key = Config.GOOGLE_MAPS_API_KEY
        self.gmaps = None
        if self.api_key:
            try:
                self.gmaps = googlemaps.Client(key=self.api_key)
            except Exception as e:
                print(f"Google Maps initialization error: {e}")
    
    def calculate_route(self, stops: List[Dict]) -> Dict:
        """
        Calculate route through multiple stops
        Args:
            stops: List of stop dictionaries with lat/lng
        Returns:
            Dictionary with route information including total distance
        """
        if not self.gmaps:
            return {
                'error': 'Google Maps API not configured',
                'total_distance_km': 0,
                'segments': []
            }

        if len(stops) < 2:
            return {
                'total_distance_km': 0,
                'segments': []
            }

        try:
            segments = []
            total_distance_meters = 0

            # Calculate distance for each segment
            for i in range(len(stops) - 1):
                origin = (stops[i]['latitude'], stops[i]['longitude'])
                destination = (stops[i + 1]['latitude'], stops[i + 1]['longitude'])

                # Get directions
                directions = self.gmaps.directions(
                    origin=origin,
                    destination=destination,
                    mode='driving'
                )

                if directions:
                    leg = directions[0]['legs'][0]
                    distance_meters = leg['distance']['value']
                    total_distance_meters += distance_meters

                    segment = {
                        'from_stop_id': stops[i]['id'],
                        'to_stop_id': stops[i + 1]['id'],
                        'from_name': stops[i]['name'],
                        'to_name': stops[i + 1]['name'],
                        'distance_km': round(distance_meters / 1000, 2),
                        'distance_text': leg['distance']['text'],
                        'duration_text': leg['duration']['text'],
                        'polyline': directions[0]['overview_polyline']['points']
                    }

                    # Add start_date if available (for stops)
                    if 'start_date' in stops[i]:
                        segment['start_date'] = stops[i]['start_date']

                    segments.append(segment)
            
            return {
                'total_distance_km': round(total_distance_meters / 1000, 2),
                'segments': segments
            }
            
        except Exception as e:
            print(f"Route calculation error: {e}")
            return {
                'error': str(e),
                'total_distance_km': 0,
                'segments': []
            }
    
    def calculate_distance_between_points(self, lat1: float, lng1: float, 
                                         lat2: float, lng2: float) -> Optional[float]:
        """
        Calculate distance between two GPS coordinates
        Returns: distance in kilometers or None on error
        """
        if not self.gmaps:
            return None
        
        try:
            directions = self.gmaps.directions(
                origin=(lat1, lng1),
                destination=(lat2, lng2),
                mode='driving'
            )
            
            if directions:
                distance_meters = directions[0]['legs'][0]['distance']['value']
                return round(distance_meters / 1000, 2)
            return None
            
        except Exception as e:
            print(f"Distance calculation error: {e}")
            return None


# Initialize services
geocoding_service = GeocodingService()
route_service = RouteService()
