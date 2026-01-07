import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ImageBackground, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getEnergyTips } from '../../services/api';

export default function Tips() {
    const [tipsData, setTipsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const data = await getEnergyTips();
            setTipsData(data);
        } catch (error) {
            console.error("Failed to fetch tips data", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    if (loading && !refreshing) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-white mt-4">Analyzing energy patterns...</Text>
            </SafeAreaView>
        );
    }

    const { forecast, top_devices, recommendations } = tipsData || {};

    // Hardcoded Data
    const currentStatus: string = "NORMAL";
    const predictedUsage = "24.5";
    const deviceUsageData = [
        { name: "AC", usage: 0.5, icon: "snowflake-o", tip: "AC is using more energy than usual. Consider switching into low mode." },
        { name: "TV", usage: 0.8, icon: "tv", tip: "Consider using a timer or lower brightness." },
        { name: "PC", usage: 0.4, icon: "laptop", tip: "Enable sleep mode when not in use." },
        { name: "Refrigerator", usage: 0.2, icon: "cube", tip: "Avoid frequent door openings to save cooling." },
        { name: "Washing Machine", usage: 0.5, icon: "tint", tip: "Wash full loads to maximize efficiency." },
        { name: "Heater", usage: 8.0, icon: "fire", tip: "Lower thermostat by 1°C to save ~10% energy." },
        { name: "Microwave", usage: 0.5, icon: "cutlery", tip: "Use microwave for smaller meals instead of oven." },
    ];

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                className="flex-1"
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <ScrollView
                    contentContainerStyle={{ padding: 20 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                >
                    {/* Header */}
                    <View className="mb-6 mt-2">
                        <Text className="text-3xl font-extrabold text-white tracking-tight">
                            Energy Insights
                        </Text>
                        <Text className="text-slate-300 font-semibold text-sm mt-1">
                            Smart Forecast & Recommendations
                        </Text>
                    </View>

                    {/*Predicted Daily Power Usage Section */}
                    <View className="mb-6">
                         <View className="bg-indigo-600 rounded-3xl p-6 border border-white/10 shadow-lg">
                             <View className="flex-row items-center mb-2">
                                <View className="bg-white/20 p-2 rounded-xl mr-3">
                                    <FontAwesome name="line-chart" size={20} color="white" />
                                </View>
                                <Text className="text-white font-bold text-lg">Predicted Daily Usage</Text>
                            </View>
                            <View className="items-center py-2">
                                <Text className="text-white text-5xl font-black tracking-tighter">
                                    2.487<span className="text-lg font-medium text-indigo-200"> kWh</span>
                                </Text>
                                <Text className="text-indigo-200 text-sm mt-1">Expected consumption for today</Text>
                            </View>
                        </View>
                    </View>

                    {/* 2. Power Status Section */}
                    <View className="mb-6">
                         <View className={`rounded-3xl p-6 border border-white/10 ${
                            currentStatus === 'HIGH' ? 'bg-rose-900/20' : 
                            currentStatus === 'LOW' ? 'bg-emerald-900/20' : 
                            'bg-blue-900/20'
                         }`}>
                             <View className="flex-row justify-between items-center">
                                <View>
                                    <Text className="text-slate-300 font-semibold text-sm mb-1">Current Status</Text>
                                    <Text className={`text-3xl font-black tracking-tight ${
                                        currentStatus === 'HIGH' ? 'text-rose-400' : 
                                        currentStatus === 'LOW' ? 'text-emerald-400' : 
                                        'text-blue-400'
                                    }`}>
                                        {currentStatus}
                                    </Text>
                                </View>
                                <View className={`w-16 h-16 rounded-full items-center justify-center bg-white/5`}>
                                    <FontAwesome 
                                        name={currentStatus === 'HIGH' ? 'exclamation-triangle' : currentStatus === 'LOW' ? 'leaf' : 'bolt'} 
                                        size={32} 
                                        color={currentStatus === 'HIGH' ? '#fb7185' : currentStatus === 'LOW' ? '#34d399' : '#60a5fa'} 
                                    />
                                </View>
                             </View>
                             <Text className="text-white/60 text-xs mt-3">
                                {currentStatus === 'HIGH' ? 'High power usage detected. Consider reducing load.' : 
                                 currentStatus === 'LOW' ? 'Great job! Power usage is efficient.' : 
                                 'Power usage is within normal limits.'}
                            </Text>
                        </View>
                    </View>

                    {/* 3. Device Consumption Details with Tips */}
                    <View className="mb-8">
                        <Text className="text-white font-bold text-lg mb-4 ml-1">Device Consumption</Text>
                        <View className="bg-slate-800/60 rounded-3xl p-5 border border-white/5">
                            {deviceUsageData.map((device, index) => (
                                <View key={index} className={`${index !== deviceUsageData.length - 1 ? 'mb-6 pb-6 border-b border-white/5' : ''}`}>
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center">
                                            <View className="bg-white/10 w-10 h-10 rounded-full items-center justify-center mr-4">
                                                <FontAwesome name={device.icon as any} size={16} color="#94a3b8" />
                                            </View>
                                            <Text className="text-white font-semibold text-base">{device.name}</Text>
                                        </View>
                                        <Text className="text-blue-400 font-bold">{device.usage.toFixed(1)} <span className="text-xs text-slate-500">kWh</span></Text>
                                    </View>
                                    {/* Tip Section */}
                                    <View className="ml-14 bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                                        <View className="flex-row items-center mb-1">
                                            <FontAwesome name="lightbulb-o" size={12} color="#60a5fa" style={{marginRight: 6}} />
                                            <Text className="text-blue-400 text-xs font-bold uppercase">Energy Tip</Text>
                                        </View>
                                        <Text className="text-slate-300 text-xs leading-4">
                                            {device.tip}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Top Devices Section */}
                    {top_devices && Object.keys(top_devices).length > 0 && (
                        <View className="mb-8">
                            <Text className="text-white font-bold text-lg mb-4 ml-1">Highest Consumers Today</Text>
                            <View className="bg-slate-800/60 rounded-3xl p-5 border border-white/5">
                                {Object.entries(top_devices).map(([device, usage], index) => (
                                    <View key={device} className={`flex-row items-center justify-between ${index !== Object.keys(top_devices).length - 1 ? 'mb-4 pb-4 border-b border-white/5' : ''}`}>
                                        <View className="flex-row items-center">
                                            <View className="bg-white/10 w-10 h-10 rounded-full items-center justify-center mr-4">
                                                <FontAwesome name="plug" size={16} color="#94a3b8" />
                                            </View>
                                            <Text className="text-white font-semibold text-base">{device}</Text>
                                        </View>
                                        <Text className="text-blue-400 font-bold">{String(usage)} <span className="text-xs text-slate-500">kWh</span></Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Recommendations Section */}
                    {recommendations && recommendations.length > 0 ? (
                        <View>
                            <Text className="text-white font-bold text-lg mb-4 ml-1">Personalized Tips</Text>
                            {recommendations.map((rec: any, index: number) => (
                                <TipCard
                                    key={index}
                                    icon="lightbulb-o"
                                    color={getPriorityColor(rec.level)}
                                    title={`Device Alert: ${rec.device}`}
                                    description={rec.recommendation}
                                    priority={rec.level}
                                    usage={rec.usage_kwh}
                                />
                            ))}
                        </View>
                    ) : (
                        loading && (
                            <View className="p-10 items-center">
                                <FontAwesome name="check-circle" size={40} color="#22c55e" />
                                <Text className="text-slate-400 mt-4 text-center">No active recommendations. Your energy usage looks optimized!</Text>
                            </View>
                        )
                    )}

                    <View className="h-20" />
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const getPriorityColor = (level: string) => {
    switch (level) {
        case 'HIGH': return '#ef4444'; // red
        case 'MEDIUM': return '#f59e0b'; // amber
        default: return '#3b82f6'; // blue
    }
};

const TipCard = ({ icon, color, title, description, priority, usage }: any) => {
    const priorityColors: any = {
        HIGH: 'bg-rose-500/20 border-rose-500/30',
        MEDIUM: 'bg-amber-500/20 border-amber-500/30',
        LOW: 'bg-blue-500/20 border-blue-500/30'
    };

    const priorityTextColors: any = {
        HIGH: 'text-rose-400',
        MEDIUM: 'text-amber-400',
        LOW: 'text-blue-400'
    };

    return (
        <View className={`rounded-2xl p-4 mb-3 border ${priorityColors[priority] || priorityColors.LOW}`}>
            <View className="flex-row items-start">
                <View className="mr-3 mt-1">
                    <FontAwesome name={icon} size={22} color={color} />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-white font-bold text-base flex-1 mr-2">{title}</Text>
                        <Text className={`${priorityTextColors[priority] || priorityTextColors.LOW} text-xs font-bold uppercase`}>
                            {priority}
                        </Text>
                    </View>
                    <Text className="text-slate-300 text-sm leading-5 mb-2">{description}</Text>
                    {usage && (
                         <Text className="text-slate-500 text-xs">Current Usage: {usage} kWh</Text>
                    )}
                </View>
            </View>
        </View>
    );
};
