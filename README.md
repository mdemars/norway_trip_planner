# Trip Planner

A locally hosted web application for planning trips with multiple stops, activities, and route visualization.

## Features

- **Trip Management**: Create and manage multiple trips
- **Stop Planning**: Define stops with dates, locations (GPS or address), and details
- **Activity Tracking**: Add things to do at each stop with descriptions and URLs
- **Route Visualization**: View all stops on an interactive map
- **Distance Calculation**: Automatically calculate distances between stops using Google Maps
- **Geocoding**: Convert between addresses and GPS coordinates automatically

## Requirements

- Python 3.8 or higher
- Google Maps API Key (for route calculation and geocoding)

## Installation

### Linux/Mac

1. Clone or download the repository
2. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

### Windows

1. Clone or download the repository
2. Run the setup script:
   ```
   setup.bat
   ```

### Manual Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:
   - Linux/Mac: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` and add your Google Maps API key

6. Initialize the database:
   ```bash
   python init_db.py
   ```

## Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Directions API
   - Geocoding API
4. Create an API key
5. Add the API key to your `.env` file

**Note**: Google Maps API has a free tier with generous limits. For personal use, you likely won't exceed the free quota.

## Running the Application

### Using Run Scripts

**Linux/Mac:**
```bash
chmod +x run.sh
./run.sh
```

**Windows:**
```
run.bat
```

### Manual Run

1. Activate the virtual environment (if not already activated)
2. Run the application:
   ```bash
   python app.py
   ```

3. Open your browser to: `http://localhost:5000`

## Usage

### Creating a Trip

1. Click "Create New Trip" on the home page
2. Enter a trip name
3. Click "Create"

### Adding Stops

1. Open a trip
2. Click "Add Stop"
3. Fill in the details:
   - **Name**: Stop name/location
   - **Start Date**: When you arrive
   - **End Date**: When you leave
   - **Location Type**: Choose GPS or Address
   - **Location**: Enter coordinates or address

### Adding Activities

1. Within a stop, click "Add Activity"
2. Enter:
   - **Name**: Activity name
   - **Description**: What you'll do
   - **URL**: Optional link (booking, website, etc.)

### Viewing Routes

- The map automatically displays all stops
- Route lines connect stops in order
- Distance calculations appear in the stop list
- Total trip distance is shown at the top

### Reordering Stops

- Drag and drop stops to reorder them
- Routes and distances update automatically

## Project Structure

```
Norway Trip/
├── app.py                 # Main Flask application
├── models.py              # Database models
├── services.py            # Google Maps & geocoding services
├── config.py              # Configuration management
├── init_db.py             # Database initialization utility
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (create from .env.example)
├── .env.example           # Environment variables template
├── setup.sh               # Setup script (Linux/Mac)
├── setup.bat              # Setup script (Windows)
├── run.sh                 # Run script (Linux/Mac)
├── run.bat                # Run script (Windows)
├── database.db            # SQLite database (auto-created)
├── static/
│   ├── css/
│   │   └── style.css      # Custom styles
│   └── js/
│       ├── map.js         # Map functionality
│       ├── trip.js        # Trip management
│       └── stops.js       # Stop/activity management
└── templates/
    ├── base.html          # Base template
    ├── index.html         # Trip list page
    └── trip_detail.html   # Trip detail page
```

## API Endpoints

### Trips
- `GET /api/trips` - List all trips
- `POST /api/trips` - Create a trip
- `GET /api/trips/<id>` - Get trip details
- `PUT /api/trips/<id>` - Update trip
- `DELETE /api/trips/<id>` - Delete trip

### Stops
- `GET /api/trips/<id>/stops` - List stops
- `POST /api/trips/<id>/stops` - Create stop
- `GET /api/stops/<id>` - Get stop details
- `PUT /api/stops/<id>` - Update stop
- `DELETE /api/stops/<id>` - Delete stop
- `POST /api/stops/reorder` - Reorder stops

### Activities
- `POST /api/stops/<id>/activities` - Create activity
- `PUT /api/activities/<id>` - Update activity
- `DELETE /api/activities/<id>` - Delete activity

### Routes
- `GET /api/trips/<id>/route` - Calculate route and distances

## Database Management

### Initialize Database
```bash
python init_db.py
```

### Reset Database (WARNING: Deletes all data)
```bash
python init_db.py --reset
```

## Troubleshooting

### Google Maps API not working
- Verify your API key is correct in `.env`
- Check that the required APIs are enabled in Google Cloud Console
- Ensure billing is enabled (free tier is sufficient for personal use)

### Database errors
- Try resetting the database: `python init_db.py --reset`
- Check file permissions on `database.db`

### Port already in use
- Change the port in `app.py`: `app.run(port=5001)`
- Or stop the process using port 5000

### Geocoding not working
- The app uses OpenStreetMap's Nominatim service (no API key needed)
- If geocoding fails, enter GPS coordinates directly

## Development

### Adding Features
- Backend: Modify `app.py` for new routes, `models.py` for database changes
- Frontend: Add JavaScript in `static/js/`, HTML in `templates/`
- Services: Extend `services.py` for new external integrations

### Database Changes
After modifying models:
1. Delete `database.db`
2. Run `python init_db.py`

## Security Notes

- This is designed for **local use only**
- Do not expose to the internet without adding authentication
- Keep your `.env` file secure and never commit it to version control
- The `.gitignore` file is configured to exclude sensitive files

## License

This project is provided as-is for personal use.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the Google Maps API setup
3. Verify all dependencies are installed correctly
