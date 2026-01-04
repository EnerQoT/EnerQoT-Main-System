# Backend Flask Application

This directory contains the Flask backend application for the EnerQoT system.

## Project Structure

```
backend/
├── app/                    # Main application package
│   ├── __init__.py        # Application factory
│   ├── api/               # API blueprints and routes
│   │   ├── __init__.py
│   │   └── routes/        # Route definitions
│   ├── models/            # Database models
│   ├── services/          # Business logic layer
│   ├── utils/             # Helper functions and utilities
│   └── middleware/        # Custom middleware
├── config/                # Configuration files
│   └── __init__.py       # Environment-specific configs
├── tests/                 # Test suite
│   └── __init__.py
├── run.py                 # Application entry point
├── requirements.txt       # Python dependencies
└── .env.example          # Environment variables template
```

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the application:
```bash
python run.py
```

## Development

- **Running tests**: `pytest`
- **Code formatting**: `black .`
- **Linting**: `flake8 .`

## API Documentation

API documentation will be available at `/api/docs` when the server is running.
