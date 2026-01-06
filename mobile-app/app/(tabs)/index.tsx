import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ImageBackground, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLatestStatus, sendFeedback } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { usePower } from '../contexts/PowerContext';

export default function Home() {
    const [data, setData] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const router = useRouter();
    const { isPowerOn } = usePower();

    const handleFeedback = async (correctLabel: number) => {
        if (!data) return;
        try {
            await sendFeedback(data.device_id || 'testdayve', correctLabel);
            setShowMenu(false);
            alert("Feedback Sent! Model is learning...");
        } catch (error) {
            console.error("Error sending feedback:", error);
            alert("Failed to send feedback");
        }
    };

    const fetchData = async () => {
        if (!isPowerOn) return; // Don't fetch if power is off

        try {
            const result = await getLatestStatus();
            if (result && result.data) {
                setData(result);
            }
        } catch (e) {
            console.log("Error fetching data", e);
        }
    };

    useEffect(() => {
        if (!isPowerOn) return; // Don't poll if power is off

        const interval = setInterval(fetchData, 2000);
        fetchData();
        return () => clearInterval(interval);
    }, [isPowerOn]);

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
                    {!isPowerOn ? (
                        <View className="w-full rounded-3xl p-6 shadow-xl mb-6 bg-slate-700">
                            <View className="flex-row justify-between items-start">
                                <View>
                                    <Text className="text-white/80 font-bold text-xs uppercase tracking-wider mb-1">
                                        Current Status
                                    </Text>
                                    <Text className="text-white text-4xl font-black tracking-tighter">
                                        OFFLINE
                                    </Text>
                                </View>
                                <View className="bg-white/20 p-3 rounded-2xl">
                                    <FontAwesome name="power-off" size={24} color="white" />
                                </View>
                            </View>

                            <View className="mt-6 bg-black/10 rounded-xl p-3 flex-row items-center">
                                <FontAwesome name="info-circle" size={16} color="white" className="opacity-80" />
                                <Text className="text-white font-medium ml-2 opacity-90">
                                    Turn on device to view current status
                                </Text>
                            </View>
                        </View>
                    ) : (
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
                                <View className="flex-row items-center">
                                    <View className="bg-white/20 p-3 rounded-2xl mr-2">
                                        <FontAwesome name={isCritical ? "warning" : "check"} size={24} color="white" />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowMenu(true)}
                                        className="bg-white/20 p-3 rounded-2xl"
                                    >
                                        <FontAwesome name="ellipsis-v" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="mt-6 bg-black/10 rounded-xl p-3 flex-row items-center">
                                <FontAwesome name="info-circle" size={16} color="white" className="opacity-80" />
                                <Text className="text-white font-medium ml-2 opacity-90">
                                    {statusText}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Power Control Button */}
                    <PowerToggleButton />

                    {/* Quick Metrics */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Quick Overview</Text>
                    <View className="flex-row flex-wrap justify-between mb-6">
                        <MetricCard
                            label="Voltage"
                            value={isPowerOn ? data?.data?.voltage : undefined}
                            unit="V"
                            icon="flash"
                            color="#facc15"
                        />
                        <MetricCard
                            label="Current"
                            value={isPowerOn ? data?.data?.current : undefined}
                            unit="A"
                            icon="bolt"
                            color="#22d3ee"
                        />
                        <MetricCard
                            label="Power"
                            value={isPowerOn ? power : undefined}
                            unit="W"
                            icon="fire"
                            color="#f97316"
                        />
                        <MetricCard
                            label="Temp"
                            value={isPowerOn ? data?.data?.temperature : undefined}
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

            {/* Feedback Menu Modal */}
            <Modal
                visible={showMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
                <TouchableOpacity
                    className="flex-1 bg-black/50 justify-center items-center"
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View className="bg-slate-800 rounded-3xl p-6 mx-8 w-80 border border-white/10">
                        <Text className="text-white font-bold text-lg mb-4">AI Feedback</Text>

                        <TouchableOpacity
                            onPress={() => handleFeedback(isCritical ? 1 : 0)}
                            className="bg-green-600 rounded-2xl p-4 mb-3 flex-row items-center"
                        >
                            <View className="bg-white/20 p-2 rounded-full mr-3">
                                <FontAwesome name="check" size={18} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">Confirm Status</Text>
                                <Text className="text-white/70 text-xs mt-1">Detection is accurate</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleFeedback(isCritical ? 0 : 1)}
                            className="bg-red-600 rounded-2xl p-4 mb-3 flex-row items-center"
                        >
                            <View className="bg-white/20 p-2 rounded-full mr-3">
                                <FontAwesome name="times" size={18} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">Report Error</Text>
                                <Text className="text-white/70 text-xs mt-1">False alarm detected</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowMenu(false)}
                            className="bg-slate-700 rounded-2xl p-3 items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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

const PowerToggleButton = () => {
    const { isPowerOn, togglePower } = usePower();

    return (
        <TouchableOpacity
            onPress={togglePower}
            className={`w-full rounded-3xl p-6 shadow-xl mb-6 ${isPowerOn ? 'bg-green-600' : 'bg-slate-700'}`}
            activeOpacity={0.7}
        >
            <View className="flex-row justify-between items-center">
                <View className="flex-1">
                    <Text className="text-white/80 font-bold text-xs uppercase tracking-wider mb-1">
                        Device Power
                    </Text>
                    <Text className="text-white text-3xl font-black tracking-tighter">
                        {isPowerOn ? 'ON' : 'OFF'}
                    </Text>
                    <Text className="text-white/70 text-sm mt-2">
                        {isPowerOn ? 'Real-time monitoring active' : 'Device powered off'}
                    </Text>
                </View>
                <View className={`p-5 rounded-full ${isPowerOn ? 'bg-white/20' : 'bg-white/10'}`}>
                    <FontAwesome
                        name="power-off"
                        size={32}
                        color="white"
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

