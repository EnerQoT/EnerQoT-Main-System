import axios from 'axios';
import { Platform } from 'react-native';

// For Physical Device Testing (LAN IP):
// const BASE_URL = 'http://192.168.1.44:5000';

const BASE_URL = Platform.select({
    web: 'http://localhost:5000',
    android: 'http://192.168.1.44:5000',
    ios: 'http://192.168.1.44:5000',
    default: 'http://192.168.1.44:5000',
});

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Existing APIs
export const getLatestStatus = async (deviceId: string = 'test_device_01') => {
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
        const response = await api.get('/tips');
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

export default api;
