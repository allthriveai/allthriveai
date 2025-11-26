# Events Calendar Feature

## Overview

The Events Calendar feature allows users to view upcoming events, and administrators to create and manage events within the AllThrive AI platform. Events are displayed in a sidebar panel that can be accessed from any page.

## Features

### For All Users
- View all published events in calendar and list views
- Toggle between calendar and list views
- See event details including:
  - Title, description, date/time
  - Location (physical or virtual)
  - Event URL for registration/more info
  - Event thumbnails
- Filter events by status (upcoming, ongoing, past)
- Visual indicators for event status (color-coded badges)
- Click on calendar dates to see events for that day

### For Admin Users
- Create new events
- Edit existing events
- Delete events
- Set event visibility (published/unpublished)
- Customize event color for calendar display
- Add event thumbnails

## Usage

### Accessing the Events Calendar

1. Navigate to any page in the application
2. Click on **"Events Calendar"** in the left sidebar under the **MEMBERSHIP** section
3. The events calendar panel will slide in from the right side

### Viewing Events

**Calendar View:**
- Navigate between months using the arrow buttons
- Dots on calendar dates indicate events
- Click a date to view events for that day (switches to list view)
- Today's date is highlighted

**List View:**
- All events are shown in chronological order
- Each event displays:
  - Status badge (Upcoming, Ongoing, Past)
  - Date and time
  - Location
  - Description preview
  - Event details link (if available)
- Past events appear with reduced opacity

### Creating Events (Admin Only)

1. Open the Events Calendar panel
2. Click the **+** button in the panel header
3. Fill out the event form:
   - **Title** (required): Event name
   - **Description**: Detailed event information
   - **Start Date & Time** (required)
   - **End Date & Time** (required)
   - **All-day event**: Check for all-day events
   - **Location**: Physical or virtual location
   - **Event URL**: Link to registration or more info
   - **Thumbnail URL**: Image for the event
   - **Event Color**: Color for calendar display (default: blue)
   - **Publish immediately**: Make event visible to users
4. Click **"Create Event"**

## API Endpoints

All endpoints are under `/api/v1/events/`

### GET `/api/v1/events/`
List all events (authenticated users only)

**Response:**
```json
[
  {
    "id": 1,
    "title": "Community Meetup",
    "description": "Monthly community gathering",
    "start_date": "2025-12-01T18:00:00Z",
    "end_date": "2025-12-01T20:00:00Z",
    "location": "Virtual",
    "event_url": "https://meet.example.com/meetup",
    "is_all_day": false,
    "color": "#3b82f6",
    "thumbnail": "https://example.com/image.jpg",
    "created_by": 1,
    "created_by_username": "admin",
    "is_published": true,
    "is_past": false,
    "is_upcoming": true,
    "is_ongoing": false
  }
]
```

### GET `/api/v1/events/{id}/`
Get a single event

### GET `/api/v1/events/upcoming/`
Get only upcoming events

### GET `/api/v1/events/past/`
Get only past events

### GET `/api/v1/events/ongoing/`
Get currently ongoing events

### GET `/api/v1/events/date_range/?start={date}&end={date}`
Get events within a date range

### POST `/api/v1/events/` (Admin only)
Create a new event

**Request:**
```json
{
  "title": "Workshop: AI Prompts",
  "description": "Learn advanced prompting techniques",
  "start_date": "2025-12-15T14:00:00Z",
  "end_date": "2025-12-15T16:00:00Z",
  "location": "Online",
  "event_url": "https://zoom.us/j/123456",
  "is_all_day": false,
  "color": "#10b981",
  "thumbnail": "https://example.com/workshop.jpg",
  "is_published": true
}
```

### PATCH `/api/v1/events/{id}/` (Admin only)
Update an event

### DELETE `/api/v1/events/{id}/` (Admin only)
Delete an event

## Architecture

### Backend

**Domain:** `core/events/`

Files:
- `models.py` - Event model with fields for title, dates, location, etc.
- `serializers.py` - EventSerializer for API responses
- `views.py` - EventViewSet with CRUD operations and custom actions
- `tests/test_events.py` - Unit and integration tests

**Permissions:**
- Read: Any authenticated user
- Write (Create/Update/Delete): Admin users only (`is_staff=True`)

**Features:**
- Automatic `created_by` assignment
- Filter unpublished events for non-admin users
- Computed properties: `is_past`, `is_upcoming`, `is_ongoing`
- Validation: End date must be after start date

### Frontend

**Location:** `frontend/src/components/events/`

Components:
- `RightEventsCalendarPanel.tsx` - Main sidebar panel
- `EventsCalendar.tsx` - Mini calendar view with date selection
- `EventsList.tsx` - List view of events with details
- `EventForm.tsx` - Admin form for creating events

**Service:** `frontend/src/services/eventsService.ts`
- API client for all event operations
- TypeScript interfaces for Event and CreateEventData

**Integration:**
- Integrated into `DashboardLayout.tsx`
- Menu item in `menuData.ts` under MEMBERSHIP section
- Uses `date-fns` for date formatting

## Database Schema

**Table:** `core_event`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| title | String(200) | Event title |
| description | Text | Event description |
| start_date | DateTime | Event start date and time |
| end_date | DateTime | Event end date and time |
| location | String(255) | Event location |
| event_url | URL | External event link |
| is_all_day | Boolean | All-day event flag |
| color | String(7) | Hex color code |
| thumbnail | URL | Event thumbnail image |
| created_by_id | ForeignKey | User who created event |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last update timestamp |
| is_published | Boolean | Visibility flag |

**Indexes:**
- `(start_date, end_date)` - For date range queries
- `is_published` - For filtering published events

## Testing

Run tests:
```bash
# All tests
make test

# Events tests only
docker-compose exec web python manage.py test core.events
```

Test coverage includes:
- Event model creation and properties
- API authentication and authorization
- CRUD operations
- Admin-only restrictions
- Date filtering (upcoming, past, ongoing)

## Future Enhancements

Potential improvements:
- Event RSVP/attendance tracking
- Email notifications for upcoming events
- Recurring events support
- Event categories/tags
- Calendar export (iCal format)
- Integration with external calendars (Google Calendar, Outlook)
- Event search and filtering
- Event reminders
