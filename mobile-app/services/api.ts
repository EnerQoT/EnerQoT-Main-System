import axios from 'axios';
import { API_BASE_URL } from '../constants/Config';

const BASE_URL = API_BASE_URL;

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Existing APIs
export const getLatestStatus = async (deviceId: string) => {
    try {
        const response = await api.get(`/status?device_id=${deviceId}`);
        return response.data;
    } catch (error: any) {
        console.error("API Error fetching /status:", error.message);
        return null;
    }
};

export const sendFeedback = async (deviceId: string, correctLabel: number) => {
    try {
        const response = await api.post('/feedback', {
            device_id: deviceId,
            correct_label: correctLabel
        });
        return response.data;
    } catch (error) {
        console.error("Feedback Error:", error);
        return null;
    }
};

// New APIs for real data integration

export const sendDeviceCommand = async (deviceId: string, command: string) => {
    try {
        const response = await api.post('/device/control', {
            device_id: deviceId,
            command
        });
        return response.data;
    } catch (error) {
        console.error("Error sending device command:", error);
        return null;
    }
};

export const getHistoricalData = async (deviceId: string, range: string) => {
    try {
        const response = await api.get(`/history/${deviceId}?range=${range}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching historical data:", error);
        return null;
    }
};

export const getNotifications = async (deviceId: string, severity: string = 'all', limit: number = 50) => {
    try {
        const response = await api.get(`/notifications/${deviceId}?severity=${severity}&limit=${limit}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return null;
    }
};

export const markNotificationRead = async (notificationId: string) => {
    try {
        const response = await api.put(`/notifications/${notificationId}/read`);
        return response.data;
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return null;
    }
};

export const getAnomalies = async (deviceId: string, days: number = 7) => {
    try {
        const response = await api.get(`/anomalies/${deviceId}?days=${days}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching anomalies:", error);
        return null;
    }
};

export const getDeviceHealth = async (deviceId: string) => {
    try {
        const response = await api.get(`/device-health/${deviceId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching device health:", error);
        return null;
    }
};

export const getEnergyTips = async () => {
    try {
        const response = await api.get('/api/tips/all');
        return response.data;
    } catch (error) {
        console.error("Error fetching tips:", error);
        return null;
    }
};

export const getReports = async (deviceId: string, period: string = 'daily') => {
    try {
        const response = await api.get(`/reports/${deviceId}?period=${period}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching reports:", error);
        return null;
    }
};

export interface PzemData {
    current: number;
    energy: number;
    frequency: number;
    pf: number;
    power: number;
    voltage: number;
}

export interface RealTimeSensorData {
  ina3221?: {
    battery?: { current_ma: number; voltage: number };
    esp?: { current_ma: number; voltage: number };
    main?: { current_ma: number; voltage: number };
  };
  pzem?: {
    current: number;
    energy: number;
    frequency: number;
    pf: number;
    power: number;
    voltage: number;
  };
  relay?: string;
  si7021?: {
    humidity: number;
    temperature: number;
  };
  system?: {
    cpu_temp: number;
    free_heap: number;
    reconnects: number;
    rssi: number;
  };
  timestamp?: string;
}

export interface TelemetryResponse {
    status: string;
    analysis: {
        device: string;
        current_usage: number;
        status: string;
        message: string;
        historical_mean: number;
        std_dev: number;
    };
}

export const postTelemetry = async (device: string, usage: number): Promise<TelemetryResponse | null> => {
    try {
        console.log(`[Telemetry] Sending: device=${device}, usage=${usage}`);
        const response = await api.post('/api/tips/telemetry', { device, usage });
        console.log(`[Telemetry] Response:`, response.data);
        return response.data;
    } catch (error: any) {
        console.error('Error posting telemetry data:', error.message || error);
        return null;
    }
};

export const fetchLatestSensorData = async (): Promise<RealTimeSensorData | null> => {
    try {
        const response = await api.get('/api/tips/realtime');
        return response.data as RealTimeSensorData;
    } catch (error: any) {
        console.error('[API] Error fetching realtime data from backend tips endpoint:', error.message);
        return null;
    }
};

export default api;
