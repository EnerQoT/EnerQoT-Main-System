import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLatestStatus } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function Home() {
    const [data, setData] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const fetchData = async () => {
        try {
            // const result = await getLatestStatus();
            // if (result && result.data) {
            //    setData(result);
            // }
            return; // Stop test requests until real device ID is available
        } catch (e) {
            console.log("Error fetching data", e);
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchData, 2000);
        fetchData();
        return () => clearInterval(interval);
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchData().then(() => setRefreshing(false));
    }, []);

    const severity = data?.severity || "NORMAL";
    const isCritical = severity === "CRITICAL";
    const isWarning = severity === "WARNING";

    let statusBg = "bg-blue-600";
    let statusText = "System is Stable";
    if (isCritical) {
        statusBg = "bg-rose-600";
        statusText = "Critical Anomaly Detected";
    } else if (isWarning) {
        statusBg = "bg-amber-500";
        statusText = "Warning: Check parameters";
    }

    const power = data?.data ? (data.data.voltage * data.data.current * data.data.power_factor).toFixed(1) : "--";

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
                    {/* Status Card */}
                    <View className={`w-full rounded-3xl p-6 shadow-xl mb-6 ${statusBg}`}>
                        <View className="flex-row justify-between items-start">
                            <View>
                                <Text className="text-white/80 font-bold text-xs uppercase tracking-wider mb-1">
                                    Current Status
                                </Text>
                                <Text className="text-white text-4xl font-black tracking-tighter">
                                    {severity}
                                </Text>
                            </View>
                            <View className="bg-white/20 p-3 rounded-2xl">
                                <FontAwesome name={isCritical ? "warning" : "check"} size={24} color="white" />
                            </View>
                        </View>

                        <View className="mt-6 bg-black/10 rounded-xl p-3 flex-row items-center">
                            <FontAwesome name="info-circle" size={16} color="white" className="opacity-80" />
                            <Text className="text-white font-medium ml-2 opacity-90">
                                {statusText}
                            </Text>
                        </View>
                    </View>

                    {/* Quick Metrics */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Quick Overview</Text>
                    <View className="flex-row flex-wrap justify-between mb-6">
                        <MetricCard
                            label="Voltage"
                            value={data?.data?.voltage}
                            unit="V"
                            icon="flash"
                            color="#facc15"
                        />
                        <MetricCard
                            label="Current"
                            value={data?.data?.current}
                            unit="A"
                            icon="bolt"
                            color="#22d3ee"
                        />
                        <MetricCard
                            label="Power"
                            value={power}
                            unit="W"
                            icon="fire"
                            color="#f97316"
                        />
                        <MetricCard
                            label="Temp"
                            value={data?.data?.temperature}
                            unit="°C"
                            icon="thermometer"
                            color="#fb7185"
                        />
                    </View>

                    {/* Quick Actions */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Quick Actions</Text>
                    <View className="flex-row justify-between mb-6">
                        <TouchableOpacity
                            onPress={() => router.push('/monitor')}
                            className="flex-1 bg-blue-600 rounded-2xl p-4 mr-2 items-center"
                        >
                            <FontAwesome name="bar-chart" size={24} color="white" />
                            <Text className="text-white font-bold mt-2 text-sm">View Details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/reports')}
                            className="flex-1 bg-purple-600 rounded-2xl p-4 ml-2 items-center"
                        >
                            <FontAwesome name="file-text-o" size={24} color="white" />
                            <Text className="text-white font-bold mt-2 text-sm">Reports</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Recent Notifications Preview */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-20">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-bold text-lg">Recent Alerts</Text>
                            <TouchableOpacity onPress={() => router.push('/notifications')}>
                                <Text className="text-blue-400 font-semibold text-sm">View All</Text>
                            </TouchableOpacity>
                        </View>
                        <NotificationItem
                            severity="WARNING"
                            message="High temperature detected"
                            time="2 min ago"
                        />
                        <NotificationItem
                            severity="NORMAL"
                            message="System stabilized"
                            time="15 min ago"
                        />
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const MetricCard = ({ label, value, unit, icon, color }: any) => (
    <View className="bg-slate-800/80 w-[48%] p-4 rounded-2xl mb-3 shadow-lg border border-white/5">
        <FontAwesome name={icon} size={20} color={color} />
        <Text className="text-2xl font-black text-white tracking-tight mt-2">
            {value !== undefined ? value : "--"}
            <Text className="text-sm text-slate-400 ml-1 font-bold">{unit}</Text>
        </Text>
        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{label}</Text>
    </View>
);

const NotificationItem = ({ severity, message, time }: any) => {
    const bgColor = severity === "CRITICAL" ? "bg-rose-500/20" : severity === "WARNING" ? "bg-amber-500/20" : "bg-blue-500/20";
    const textColor = severity === "CRITICAL" ? "text-rose-400" : severity === "WARNING" ? "text-amber-400" : "text-blue-400";

    return (
        <View className={`${bgColor} rounded-xl p-3 mb-2 flex-row items-center`}>
            <View className={`w-2 h-2 rounded-full ${severity === "CRITICAL" ? "bg-rose-500" : severity === "WARNING" ? "bg-amber-500" : "bg-blue-500"} mr-3`} />
            <View className="flex-1">
                <Text className="text-white font-semibold text-sm">{message}</Text>
                <Text className="text-slate-400 text-xs mt-1">{time}</Text>
            </View>
        </View>
    );
};
