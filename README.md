# EnerQoT Main System

A full-stack application for Energy Quality of Things (EnerQoT) system with Flask backend and React frontend.

## Project Structure

```
EnerQoT-Main-System/
├── backend/                # Flask backend application
│   ├── app/               # Main application package
│   │   ├── api/          # API routes and blueprints
│   │   ├── models/       # Database models
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utility functions
│   │   └── middleware/   # Custom middleware
│   ├── config/           # Configuration files
│   ├── tests/            # Backend tests
│   ├── run.py            # Application entry point
│   ├── requirements.txt  # Python dependencies
│   └── README.md         # Backend documentation
│
├── mobile-app/            # React Native mobile application
│   ├── public/           # Static files
│   ├── src/              # Source files
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── hooks/        # Custom hooks
│   │   ├── utils/        # Utility functions
│   │   ├── assets/       # Static assets
│   │   └── styles/       # CSS files
│   ├── package.json      # NPM dependencies
│   └── README.md         # Frontend documentation
│
├── docker-compose.yml     # Docker composition for services
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
python run.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

```bash
cd mobile-app
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

Frontend will run on `http://localhost:3000`

### Docker Setup (Optional)

```bash
docker-compose up -d
```

## Development

### Backend

- **Run tests**: `cd backend && pytest`
- **Linting**: `cd backend && flake8 .`
- **Format code**: `cd backend && black .`

### Mobile App

- **Run tests**: `cd mobile-app && npm test`
- **Linting**: `cd mobile-app && npm run lint`
- **Format code**: `cd mobile-app && npm run format`

## Architecture

### Backend (Flask)

The backend follows a modular architecture with:
- **API Layer**: RESTful API endpoints
- **Service Layer**: Business logic and data processing
- **Model Layer**: Database models and ORM
- **Middleware**: Authentication, logging, error handling

### Mobile App (React Native + Expo)

The mobile app follows component-based architecture with:
- **Pages**: Top-level route components
- **Components**: Reusable UI components
- **Services**: API communication layer
- **Hooks**: Custom React hooks for shared logic
- **Utils**: Helper functions and utilities

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.



------------------------------------------------------