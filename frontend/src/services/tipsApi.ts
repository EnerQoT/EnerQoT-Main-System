import axios from 'axios';

const TIPS_API_URL = 'http://159.223.49.246:5000/api/tips';
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

// Data format specifically for fetching from the selected document
export interface PzemData {
  current: number;
  energy: number;
  frequency: number;
  pf: number;
  power: number;
  voltage: number;
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

export const fetchLatestPzemData = async (): Promise<PzemData | null> => {
    try {
        const response = await axios.get(FIREBASE_DB_URL);
        const data = response.data;
        
        if (data) {
            // Data is an object where the key is the timestamp node
            const keys = Object.keys(data);
            if (keys.length > 0) {
                const latestReading = data[keys[0]];
                if (latestReading && latestReading.pzem) {
                    return latestReading.pzem as PzemData;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching from Firebase:', error);
        return null;
    }
};
