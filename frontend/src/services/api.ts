import axios from 'axios';

const API_URL = 'http://localhost:5000/api/admin';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface DashboardStats {
    total_devices: number;
    active_devices: number;
    total_anomalies_24h: number;
    system_health: number;
}

export interface Device {
    device_id: string;
    name: string;
    location: string;
    type: string;
    status: 'online' | 'offline';
    last_active: string | null;
    active_alerts: number;
}

export const getDashboardStats = async (): Promise<DashboardStats | null> => {
    try {
        const response = await api.get('/dashboard');
        return response.data;
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return null;
    }
};

export const getAllDevices = async (): Promise<Device[]> => {
    try {
        const response = await api.get('/devices');
        return response.data.devices;
    } catch (error) {
        console.error('Error fetching devices:', error);
        return [];
    }
};

export interface AnomalyLog {
    _id: string;
    device_id: string;
    timestamp: string;
    severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
    anomaly_score: number;
    action_taken: string;
    features: number[][];
}

export const getDeviceAnomalies = async (deviceId: string, days: number = 7): Promise<AnomalyLog[]> => {
    try {
        const response = await api.get(`/anomalies/${deviceId}`, { params: { days } });
        return response.data.anomalies;
    } catch (error) {
        console.error(`Error fetching anomalies for ${deviceId}:`, error);
        return [];
    }
};
