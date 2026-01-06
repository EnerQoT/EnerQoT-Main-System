"""
Flask application factory module.
This module contains the application factory pattern for creating Flask app instances.
"""

from flask import Flask
from flask_cors import CORS


def create_app(config_name='development'):
    """
    Application factory for creating Flask app instances.
    
    Args:
        config_name (str): The configuration name to use (development, testing, production)
    
    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__)
    
    # Load configuration
    # app.config.from_object(f'config.{config_name}')
    
    # Initialize CORS
    CORS(app)
    
    # Register blueprints
    from app.api.routes.anomaly_routes import anomaly_bp
    from app.api.routes.admin_routes import admin_bp
    app.register_blueprint(anomaly_bp)
    app.register_blueprint(admin_bp)
    
    # Initialize extensions
    # db.init_app(app)
    # migrate.init_app(app, db)
    
    return app
