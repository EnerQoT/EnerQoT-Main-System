import axios from 'axios';

const TIPS_API_URL = `${import.meta.env.VITE_API_BASE_URL}/api/tips`;
const FIREBASE_DB_URL = 'https://rp-project-51690-default-rtdb.asia-southeast1.firebasedatabase.app/sensor_readings.json?orderBy="$key"&limitToLast=1';

export const tipsApi = axios.create({
    baseURL: TIPS_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface Recommendation {
    device: string;
    message: string;
    potential_savings: number;
    priority: 'high' | 'medium' | 'low';
}

export interface TipsData {
    forecast: Record<string, number>;
    top_devices: Record<string, number>;
    recommendations: Recommendation[];
}

// Data format specifically for fetching from the realtime endpoint
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

// Data format for the /telemetry POST request
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


export const getAllTipsData = async (): Promise<TipsData | null> => {
    try {
        const response = await tipsApi.get('/all');
        return response.data;
    } catch (error) {
        console.error('Error fetching tips data:', error);
        return null;
    }
};

export const getRecommendations = async (): Promise<Recommendation[]> => {
    try {
        const response = await tipsApi.get('/recommendations');
        return response.data;
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
};

export const postTelemetry = async (device: string, usage: number): Promise<TelemetryResponse | null> => {
    try {
        const response = await tipsApi.post('/telemetry', { device, usage });
        return response.data;
    } catch (error) {
        console.error('Error posting telemetry data:', error);
        return null;
    }
};

export const fetchLatestSensorData = async (): Promise<RealTimeSensorData | null> => {
    try {
        const response = await tipsApi.get('/realtime');
        if (response.data) {
            return response.data as RealTimeSensorData;
        }
        return null;
    } catch (error) {
        console.error('Error fetching realtime data from backend:', error);
        return null;
    }
};
