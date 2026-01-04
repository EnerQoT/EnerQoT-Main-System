# Frontend React Application

This directory contains the React frontend application for the EnerQoT system.

## Project Structure

```
frontend/
├── public/                # Static files
│   └── index.html        # HTML template
├── src/                   # Source files
│   ├── components/        # Reusable React components
│   ├── pages/            # Page-level components
│   ├── services/         # API services and configurations
│   ├── utils/            # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── assets/           # Images, fonts, etc.
│   ├── styles/           # CSS files
│   ├── App.js            # Main App component
│   └── index.js          # Application entry point
├── package.json          # NPM dependencies and scripts
└── .env.example         # Environment variables template
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run the development server:
```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

## Development

- **Running tests**: `npm test`
- **Build for production**: `npm run build`
- **Linting**: `npm run lint`
- **Code formatting**: `npm run format`

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run lint` - Runs ESLint
- `npm run format` - Formats code with Prettier
