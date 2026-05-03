// Mobile App Environment Config
// Reads from .env files - EXPO_PUBLIC_ prefix is required for Expo
// Local: .env.local  |  Production: .env.production

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';
export const ENV_NAME = process.env.EXPO_PUBLIC_ENV_NAME || 'development';
