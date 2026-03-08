import axios from 'axios';
import { Platform } from 'react-native';

// For Physical Device Testing (LAN IP):
const BASE_URL = 'http://192.168.1.58:5000';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ---------------------------------------------------------------
// Anomaly & Status
// ---------------------------------------------------------------
export const getLatestStatus = async (deviceId: string) => {
    try {
        const response = await api.get(`/status?device_id=${deviceId}`);
        return response.data;
    } catch (error: any) {
        console.error("API Error fetching /status:", error.message);
        return null;
    }
};

export const sendDeviceCommand = async (deviceId: string, command: "ON" | "OFF") => {
    try {
        const response = await api.post('/device/control', {
            device_id: deviceId,
            command: command
        });
        return response.data;
    } catch (error: any) {
        console.error("Error sending device command:", error.message);
        return null;
    }
};

// ---------------------------------------------------------------
// Feedback (DQN Online Learning)
// ---------------------------------------------------------------

/**
 * Submit feedback from the Notifications screen.
 * Maps to the new /feedback/notification endpoint which
 * triggers DQN online learning and updates the notification record.
 *
 * @param notificationId  MongoDB _id of the notification
 * @param deviceId        Device that generated the anomaly
 * @param feedbackType    "confirm" (real anomaly) | "false_alarm"
 * @param correctSeverity What the severity SHOULD have been: "NORMAL" | "WARNING" | "CRITICAL"
 *                        Required when feedbackType is "false_alarm"
 */
export const sendNotificationFeedback = async (
    notificationId: string,
    deviceId: string,
    feedbackType: 'confirm' | 'false_alarm',
    correctSeverity?: 'NORMAL' | 'WARNING' | 'CRITICAL'
) => {
    try {
        const response = await api.post('/feedback/notification', {
            notification_id: notificationId,
            device_id: deviceId,
            feedback_type: feedbackType,
            ...(correctSeverity ? { correct_severity: correctSeverity } : {})
        });
        return response.data;
    } catch (error: any) {
        console.error("Notification Feedback Error:", error.message);
        return null;
    }
};

/**
 * Legacy feedback endpoint — for monitor tab or direct feedback without notification_id.
 * Pass correctSeverity when feedback_type is 'false_alarm' for graduated reward shaping.
 */
export const sendFeedback = async (
    deviceId: string,
    correctLabel: number,
    feedbackType?: 'confirm' | 'false_alarm',
    correctSeverity?: 'NORMAL' | 'WARNING' | 'CRITICAL'
) => {
    try {
        const response = await api.post('/feedback', {
            device_id: deviceId,
            correct_label: correctLabel,
            feedback_type: feedbackType,
            ...(correctSeverity ? { correct_severity: correctSeverity } : {})
        });
        return response.data;
    } catch (error: any) {
        console.error("Feedback Error:", error.message);
        return null;
    }
};

// ---------------------------------------------------------------
// Historical & Notifications
// ---------------------------------------------------------------
export const getHistoricalData = async (deviceId: string, range: string) => {
    try {
        const response = await api.get(`/history/${deviceId}?range=${range}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching historical data:", error);
        return null;
    }
};

export const getNotifications = async (
    deviceId: string,
    severity: string = 'all',
    limit: number = 50
) => {
    try {
        const response = await api.get(
            `/notifications/${deviceId}?severity=${severity}&limit=${limit}`
        );
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

export const getAgentStats = async () => {
    try {
        const response = await api.get('/agent-stats');
        return response.data;
    } catch (error) {
        console.error("Error fetching agent stats:", error);
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

export default api;