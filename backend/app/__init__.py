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
    from app.api.routes.energy_routes import energy_bp
    
    app.register_blueprint(anomaly_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(energy_bp)
    
    from app.api.routes.tips_routes import api as tips_bp
    app.register_blueprint(tips_bp, url_prefix='/api/tips')

    
    from app.api.routes.sensor_health_routes import sensor_health_bp
    app.register_blueprint(sensor_health_bp)

    from app.api.routes.dashboard_routes import dashboard_bp
    app.register_blueprint(dashboard_bp)    

    from app.api.routes.analysis_routes import analysis_bp
    app.register_blueprint(analysis_bp)
    
    # Initialize extensions
    # db.init_app(app)
    # migrate.init_app(app, db)
    
    return app
