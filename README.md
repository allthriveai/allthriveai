# AllThrive AI Django

A Django-based AI application with support for OpenAI and Anthropic integrations.

## Features

- Django REST Framework API
- Conversation management
- AI integration ready (OpenAI, Anthropic, LangChain)
- Celery task queue with Redis
- PostgreSQL support
- CORS enabled

## Setup

### 1. Create and activate virtual environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and update with your settings:

```bash
cp .env.example .env
```

### 4. Run migrations

```bash
python manage.py migrate
```

### 5. Create superuser

```bash
python manage.py createsuperuser
```

### 6. Run development server

```bash
python manage.py runserver
```

## API Endpoints

- `/admin/` - Django admin interface
- `/api/conversations/` - Conversation management
- `/api/messages/` - Message history

## Environment Variables

See `.env.example` for all available configuration options.

## Development

- Run tests: `python manage.py test`
- Create migrations: `python manage.py makemigrations`
- Apply migrations: `python manage.py migrate`

## Production Deployment

1. Set `DEBUG=False` in `.env`
2. Configure proper database (PostgreSQL recommended)
3. Set up Redis for Celery
4. Configure static files: `python manage.py collectstatic`
5. Use Gunicorn: `gunicorn config.wsgi:application`

## License

MIT
