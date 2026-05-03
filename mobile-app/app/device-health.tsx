import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';

// Backend URL - Adjust based on the environment
// Genymotion: http://10.0.3.2:5000
// Android Emulator: http://10.0.2.2:5000

const API_URL = 'http://127.0.0.1:5000/dashboard/data';

export default function DeviceHealth() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [healthData, setHealthData] = useState<any>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Chart history state
    const [chartHistory, setChartHistory] = useState({
        labels: ['-30s', '-25s', '-20s', '-15s', '-10s', '-5s', 'Now'],
        cpu_temp: [0, 0, 0, 0, 0, 0, 0],
        rssi: [-100, -100, -100, -100, -100, -100, -100],
        humidity: [0, 0, 0, 0, 0, 0, 0],
        ambient_temp: [0, 0, 0, 0, 0, 0, 0],
    });

    const generateAnalysis = async () => {
        if (!healthData) return;
        setIsGenerating(true);
        setAiAnalysis(null);
        try {
            // Call the local backend instead of Groq directly
            const response = await axios.post(`${API_URL.replace('/dashboard/data', '/api/analysis/generate')}`, {
                telemetry: {
                    cpu_temp: healthData.sensors?.cpu_temp,
                    battery_voltage: healthData.sensors?.battery_voltage,
                    rssi: healthData.sensors?.rssi,
                    health_status: healthData.health?.status || 'Unknown'
                }
            });

            if (response.data && response.data.analysis) {
                setAiAnalysis(response.data.analysis);
            } else {
                setAiAnalysis("No analysis could be generated. Please try again.");
            }
        } catch (error: any) {
            console.error("Error generating analysis:", error.response?.data || error.message);
            setAiAnalysis("Error reaching the backend analysis service. Please try again later.");
        } finally {
            setIsGenerating(false);
        }
    };

    const fetchData = async () => {
        try {
            console.log("Fetching data from:", API_URL);
            const response = await axios.get(API_URL);
            console.log("Data fetched:", response.data);
            setHealthData(response.data);
            setLastUpdated(new Date().toLocaleTimeString());

            // Update chart history
            const sensors = response.data.sensors || {};
            setChartHistory(prev => ({
                ...prev,
                cpu_temp: [...prev.cpu_temp.slice(1), sensors.cpu_temp || 0],
                rssi: [...prev.rssi.slice(1), sensors.rssi || -100],
                humidity: [...prev.humidity.slice(1), sensors.humidity || 0],
                ambient_temp: [...prev.ambient_temp.slice(1), sensors.ambient_temp || 0],
            }));
        } catch (error: any) {
            console.error("Error fetching dashboard data:", error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(); // Initial fetch
        const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: string) => {
        if (!status) return 'question-circle';
        if (status.includes('Healthy')) return 'check-circle';
        if (status.includes('Warning')) return 'exclamation-triangle';
        if (status.includes('CRITICAL')) return 'times-circle';
        return 'info-circle';
    };

    const getStatusColor = (color: string) => {
        if (color === 'green') return '#10b981';
        if (color === 'orange') return '#f59e0b';
        if (color === 'red') return '#ef4444';
        return '#94a3b8'; // gray
    };

    // Helper to format values safely
    const formatValue = (val: any, unit: string = '') => {
        return val !== null && val !== undefined ? `${val}${unit}` : '--';
    };

    const healthMetrics = healthData ? [
        { label: 'CPU Temp', value: healthData.sensors.cpu_temp, unit: '°C', status: healthData.sensors.cpu_temp > 80 ? 'warning' : 'good', icon: 'thermometer-half', color: healthData.sensors.cpu_temp > 80 ? '#f59e0b' : '#10b981' },
        { label: 'Battery', value: healthData.sensors.battery_voltage, unit: 'V', status: healthData.sensors.battery_voltage < 3.5 ? 'warning' : 'good', icon: 'battery-three-quarters', color: healthData.sensors.battery_voltage < 3.5 ? '#f59e0b' : '#10b981' },
        { label: 'Signal (RSSI)', value: healthData.sensors.rssi, unit: 'dB', status: healthData.sensors.rssi < -90 ? 'warning' : 'good', icon: 'wifi', color: healthData.sensors.rssi < -90 ? '#f59e0b' : '#10b981' },
        { label: 'Free Heap', value: healthData.sensors.free_heap_kb, unit: 'KB', status: 'good', icon: 'database', color: '#10b981' },
        { label: 'Ambient Temp', value: healthData.sensors.ambient_temp ? healthData.sensors.ambient_temp.toFixed(1) : '--', unit: '°C', status: 'good', icon: 'sun-o', color: '#10b981' },
        { label: 'Humidity', value: healthData.sensors.humidity ? healthData.sensors.humidity.toFixed(1) : '--', unit: '%', status: 'good', icon: 'tint', color: '#3b82f6' },
    ] : [];

    const systemInfo = [
        { label: 'Smart Sensor Version', value: '2.4.1' },
        { label: 'Device ID', value: 'EQ-SENSOR-X99' },
        { label: 'Firmware Build', value: '2026.05.01' },
        { label: 'Last Update', value: lastUpdated || 'Syncing...' },
    ];

    const chartConfig = {
        backgroundGradientFrom: "#1e293b",
        backgroundGradientTo: "#0f172a",
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
        propsForDots: { r: "4", strokeWidth: "2", stroke: "#10b981" },
        decimalPlaces: 1,
    };

    const rssiChartConfig = {
        ...chartConfig,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        propsForDots: { r: "4", strokeWidth: "2", stroke: "#8b5cf6" },
        decimalPlaces: 0,
    };

    const ambientTempChartConfig = {
        ...chartConfig,
        color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
        propsForDots: { r: "4", strokeWidth: "2", stroke: "#f59e0b" },
        decimalPlaces: 1,
    };

    const humidityChartConfig = {
        ...chartConfig,
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        propsForDots: { r: "4", strokeWidth: "2", stroke: "#3b82f6" },
        decimalPlaces: 1,
    };

    const screenWidth = Dimensions.get("window").width;

    if (loading && !healthData) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#10b981" />
                <Text className="text-white mt-4">Connecting to Sensor...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                className="flex-1"
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>

                    {/* Device Online/Offline Status */}
                    <View className={`rounded-2xl p-4 mb-4 flex-row items-center justify-between ${healthData?.device_online === false ? 'bg-red-500/20 border border-red-500/30' : 'bg-emerald-500/20 border border-emerald-500/30'}`}>
                        <View className="flex-row items-center">
                            <View className={`w-3 h-3 rounded-full mr-3 ${healthData?.device_online === false ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            <Text className={`font-bold text-sm ${healthData?.device_online === false ? 'text-red-400' : 'text-emerald-400'}`}>
                                {healthData?.device_online === false ? 'DEVICE OFFLINE' : 'DEVICE ONLINE'}
                            </Text>
                        </View>
                        {healthData?.data_age_seconds != null && (
                            <Text className="text-slate-400 text-xs font-medium">
                                {healthData.device_online === false
                                    ? `Last seen ${Math.round(healthData.data_age_seconds)}s ago`
                                    : `Updated ${Math.round(healthData.data_age_seconds)}s ago`}
                            </Text>
                        )}
                    </View>

                    {/* Overall Status */}
                    <View
                        className="rounded-3xl p-6 mb-6 flex-row items-center"
                        style={{ backgroundColor: healthData?.device_online === false ? '#475569' : getStatusColor(healthData?.health?.color) }}
                    >
                        <View className="bg-white/20 p-3 rounded-2xl mr-4">
                            <FontAwesome name={healthData?.device_online === false ? 'plug' as any : getStatusIcon(healthData?.health?.status) as any} size={32} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-black text-2xl">
                                {healthData?.device_online === false ? 'Offline' : (healthData?.health?.status?.split(':')[0] || 'Unknown')}
                            </Text>
                            <Text className="text-white/80 font-medium text-sm mt-1">
                                {healthData?.device_online === false
                                    ? 'Device is not sending data — showing last known values'
                                    : (healthData?.health?.status || 'Waiting for data...')}
                            </Text>
                            {healthData?.health?.score !== null && (
                                <Text className="text-white/60 text-xs mt-2 font-bold">
                                    Health Score: {healthData?.health?.score?.toFixed(1)} / 100
                                    {healthData?.device_online === false ? ' (stale)' : ''}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* AI Analysis */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-row items-center">
                                <FontAwesome name="magic" size={16} color="#3b82f6" />
                                <Text className="text-white font-bold text-lg ml-2">AI Analysis</Text>
                            </View>
                        </View>
                        <Text className="text-slate-300 text-sm leading-6 mb-4">
                            {aiAnalysis ? aiAnalysis : "Click the button below to generate a dynamic health analysis based on current sensor telemetry. This may take a few seconds."}
                        </Text>
                        <TouchableOpacity
                            onPress={generateAnalysis}
                            disabled={isGenerating || !healthData}
                            className={`rounded-2xl py-3 flex-row items-center justify-center ${isGenerating ? 'bg-slate-700' : 'bg-blue-600'}`}
                        >
                            {isGenerating ? (
                                <>
                                    <ActivityIndicator size="small" color="#94a3b8" />
                                    <Text className="text-slate-400 font-bold ml-2">Analyzing...</Text>
                                </>
                            ) : (
                                <>
                                    <FontAwesome name="rocket" size={16} color="white" />
                                    <Text className="text-white font-bold ml-2">Generate Analysis</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Health Metrics */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Real-time Metrics</Text>
                    <View className="flex-row flex-wrap justify-between mb-6">
                        {healthMetrics.length > 0 ? healthMetrics.map((metric, index) => (
                            <View key={index} className="bg-slate-800/80 w-[48%] p-4 rounded-2xl mb-3 border border-white/5">
                                <View className="flex-row items-center justify-between mb-2">
                                    <FontAwesome name={metric.icon as any} size={20} color={metric.color} />
                                    <View className={`px-2 py-1 rounded-full ${metric.status === 'good' ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                                        <Text className={`text-[10px] font-bold ${metric.status === 'good' ? 'text-green-400' : 'text-amber-400'}`}>
                                            {metric.status === 'good' ? 'OK' : 'WARN'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-2xl font-black text-white">
                                    {metric.value}
                                    <Text className="text-sm text-slate-400 font-bold">{metric.unit}</Text>
                                </Text>
                                <Text className="text-slate-400 text-xs font-bold uppercase mt-1">{metric.label}</Text>
                            </View>
                        )) : (
                            <Text className="text-slate-400 italic">No metrics available</Text>
                        )}
                    </View>

                    {/* Charts */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Historical Trends</Text>

                    <View className="bg-slate-800/80 rounded-3xl p-4 border border-white/10 mb-6">
                        <Text className="text-slate-300 font-bold mb-4">CPU Temperature (°C)</Text>
                        <LineChart
                            data={{
                                labels: chartHistory.labels,
                                datasets: [{ data: chartHistory.cpu_temp }]
                            }}
                            width={screenWidth - 88}
                            height={180}
                            chartConfig={chartConfig}
                            bezier
                            style={{ borderRadius: 16 }}
                            withInnerLines={false}
                        />
                    </View>

                    <View className="bg-slate-800/80 rounded-3xl p-4 border border-white/10 mb-6">
                        <Text className="text-slate-300 font-bold mb-4">Signal Strength (RSSI dBm)</Text>
                        <LineChart
                            data={{
                                labels: chartHistory.labels,
                                datasets: [{ data: chartHistory.rssi }]
                            }}
                            width={screenWidth - 88}
                            height={180}
                            chartConfig={rssiChartConfig}
                            bezier
                            style={{ borderRadius: 16 }}
                            withInnerLines={false}
                        />
                    </View>

                    <View className="bg-slate-800/80 rounded-3xl p-4 border border-white/10 mb-6">
                        <Text className="text-slate-300 font-bold mb-4">Ambient Temperature (°C)</Text>
                        <LineChart
                            data={{
                                labels: chartHistory.labels,
                                datasets: [{ data: chartHistory.ambient_temp }]
                            }}
                            width={screenWidth - 88}
                            height={180}
                            chartConfig={ambientTempChartConfig}
                            bezier
                            style={{ borderRadius: 16 }}
                            withInnerLines={false}
                        />
                    </View>

                    <View className="bg-slate-800/80 rounded-3xl p-4 border border-white/10 mb-6">
                        <Text className="text-slate-300 font-bold mb-4">Humidity (%)</Text>
                        <LineChart
                            data={{
                                labels: chartHistory.labels,
                                datasets: [{ data: chartHistory.humidity }]
                            }}
                            width={screenWidth - 88}
                            height={180}
                            chartConfig={humidityChartConfig}
                            bezier
                            style={{ borderRadius: 16 }}
                            withInnerLines={false}
                        />
                    </View>

                    {/* System Information */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                        <Text className="text-white font-bold text-lg mb-4">System Information</Text>
                        {systemInfo.map((info, index) => (
                            <View key={index} className="flex-row justify-between items-center py-3 border-b border-slate-700/50">
                                <Text className="text-slate-400 text-sm">{info.label}</Text>
                                <Text className="text-white font-semibold text-sm">{info.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Actions */}
                    <TouchableOpacity onPress={fetchData} className="bg-blue-600 rounded-2xl p-4 flex-row items-center justify-center mb-20">
                        <FontAwesome name="refresh" size={20} color="white" />
                        <Text className="text-white font-bold text-base ml-3">Force Refresh</Text>
                    </TouchableOpacity>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}
