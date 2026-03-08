import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { getLatestStatus, sendFeedback } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import TimeRangeSelector from '../components/TimeRangeSelector';
import { usePower } from '../contexts/PowerContext';

const screenWidth = Dimensions.get("window").width;

export default function Monitor() {
    const [data, setData] = useState<any>(null);
    const [history, setHistory] = useState<number[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState('20s');
    const { isPowerOn } = usePower();

    // Determine max data points and polling interval based on time range
    const getTimeRangeConfig = (range: string) => {
        const configs: any = {
            '20s': { maxPoints: 20, interval: 2000 },      // Poll every 2 seconds
            '1m': { maxPoints: 60, interval: 2000 },
            '5m': { maxPoints: 60, interval: 5000 },
            '15m': { maxPoints: 60, interval: 15000 },
            '1h': { maxPoints: 60, interval: 60000 },
            '5h': { maxPoints: 60, interval: 300000 },
            '1d': { maxPoints: 48, interval: 1800000 },
            'week': { maxPoints: 56, interval: 10800000 },
            'month': { maxPoints: 60, interval: 43200000 },
            'year': { maxPoints: 52, interval: 604800000 },
        };
        return configs[range] || configs['20s'];
    };

    const config = getTimeRangeConfig(timeRange);

    // Poll for data
    const fetchData = async () => {
        if (!isPowerOn) return; // Don't fetch if power is off

        try {
            const result = await getLatestStatus('testdayve'); // Pass device ID
            // console.log('Fetched data:', result); // Debug log
            if (result && result.data) {
               setData(result);
               // Calculate Power (W) = V * I * PF
               const power = result.data.voltage * result.data.current * result.data.power_factor;
               setHistory(prev => {
                   const newHist = [...prev, power];
                   if (newHist.length > config.maxPoints) newHist.shift();
                   return newHist;
               });
            }
        } catch (e) {
            console.log("Error fetching data", e);
        }
    };

    useEffect(() => {
        if (!isPowerOn) return; // Don't poll if power is off

        const interval = setInterval(fetchData, config.interval);
        fetchData(); // Initial fetch
        return () => clearInterval(interval);
    }, [timeRange, isPowerOn]);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchData().then(() => setRefreshing(false));
    }, []);

    const handleFeedback = async (correctLabel: number) => {
        if (!data) return;
        await sendFeedback(data.device_id, correctLabel);
        alert("Feedback Sent! Model is learning...");
    };

    const severity = data?.severity || "NORMAL";
    const isCritical = severity === "CRITICAL";
    const isWarning = severity === "WARNING";

    // Dynamic Background Colors
    let statusBg = "bg-blue-600";
    let statusText = "System is Stable";
    if (isCritical) {
        statusBg = "bg-rose-600";
        statusText = "Critical Anomaly Detected";
    } else if (isWarning) {
        statusBg = "bg-amber-500";
        statusText = "Warning: Check parameters";
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                className="flex-1"
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                    contentContainerStyle={{ padding: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Live Metrics Grid */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Live Metrics</Text>
                    <View className="flex-row flex-wrap justify-between mb-2">
                        <SensorCard
                            label="Voltage"
                            value={isPowerOn ? data?.data?.voltage : undefined}
                            unit="V"
                            icon="flash"
                            color="text-yellow-400"
                            bgColor="bg-yellow-400/10"
                        />
                        <SensorCard
                            label="Current"
                            value={isPowerOn ? data?.data?.current : undefined}
                            unit="A"
                            icon="bolt"
                            color="text-cyan-400"
                            bgColor="bg-cyan-400/10"
                        />
                        <SensorCard
                            label="Frequency"
                            value={isPowerOn ? data?.data?.frequency : undefined}
                            unit="Hz"
                            icon="dashboard"
                            color="text-purple-400"
                            bgColor="bg-purple-400/10"
                        />
                        <SensorCard
                            label="Temp"
                            value={isPowerOn ? data?.data?.temperature : undefined}
                            unit="°C"
                            icon="thermometer"
                            color="text-rose-400"
                            bgColor="bg-rose-400/10"
                        />
                    </View>

                    {/* Time Range Selector */}
                    <View className="mb-6">
                        <Text className="text-white font-bold text-lg mb-3 ml-1">Time Range</Text>
                        <TimeRangeSelector selected={timeRange} onSelect={setTimeRange} />
                    </View>

                    {/* Power Chart */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 shadow-lg mb-8 border border-white/10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-white">
                                Power Consumption
                            </Text>
                            <Text className="text-slate-400 text-xs font-bold uppercase">
                                {timeRange === '20s' ? 'Last 20s' :
                                    timeRange === '1m' ? 'Last 1 min' :
                                        timeRange === '5m' ? 'Last 5 min' :
                                            timeRange === '15m' ? 'Last 15 min' :
                                                timeRange === '1h' ? 'Last 1 hour' :
                                                    timeRange === '5h' ? 'Last 5 hours' :
                                                        timeRange === '1d' ? 'Last 24 hours' :
                                                            timeRange === 'week' ? 'Last Week' :
                                                                timeRange === 'month' ? 'Last Month' : 'Last Year'}
                            </Text>
                        </View>

                        {history.length > 0 ? (
                            <LineChart
                                data={{
                                    labels: [],
                                    datasets: [{ data: history }]
                                }}
                                width={screenWidth - 80}
                                height={220}
                                withDots={false}
                                withInnerLines={true}
                                withOuterLines={false}
                                withVerticalLines={false}
                                yAxisInterval={1}
                                chartConfig={{
                                    backgroundColor: "transparent",
                                    backgroundGradientFrom: "#1e293b",
                                    backgroundGradientTo: "#1e293b",
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(56, 189, 248, ${opacity})`, // Light Blue
                                    labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                    propsForBackgroundLines: {
                                        strokeDasharray: "4",
                                        stroke: "#334155"
                                    },
                                    fillShadowGradientFrom: "#38bdf8",
                                    fillShadowGradientTo: "#1e293b",
                                    fillShadowGradientOpacity: 0.3,
                                }}
                                bezier
                                style={{ borderRadius: 16 }}
                            />
                        ) : (
                            <View className="h-48 justify-center items-center bg-white/5 rounded-2xl">
                                <Text className="text-slate-400 font-medium">Waiting for sensors...</Text>
                            </View>
                        )}
                    </View>


                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const SensorCard = ({ label, value, unit, icon, color, bgColor }: any) => (
    <View className="bg-slate-800/80 w-[48%] p-5 rounded-3xl mb-4 shadow-lg border border-white/5 backdrop-blur-sm">
        <View className={`w-10 h-10 ${bgColor} rounded-full justify-center items-center mb-3`}>
            {/* Note: NativeWind text color class doesn't always apply to Icon props directly, so passing style too */}
            <FontAwesome name={icon} size={18} color={color === 'text-yellow-400' ? '#facc15' : color === 'text-cyan-400' ? '#22d3ee' : color === 'text-purple-400' ? '#a78bfa' : '#fb7185'} />
        </View>
        <Text className="text-3xl font-black text-white tracking-tight">
            {value !== undefined ? value : "--"}
            <Text className="text-sm text-slate-400 ml-1 font-bold">{unit}</Text>
        </Text>
        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{label}</Text>
    </View>
);
