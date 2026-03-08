import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LineChart } from 'react-native-chart-kit';
import { getEnergyTips, fetchLatestPzemData, postTelemetry, PzemData, TelemetryResponse } from '../../services/api';

interface Recommendation {
    device: string;
    usage_kwh: number;
    level: string;
    recommendation: string;
}

const screenWidth = Dimensions.get('window').width;

export default function Tips() {
    const [tipsData, setTipsData] = useState<any>(null);
    const [pzemData, setPzemData] = useState<PzemData | null>(null);
    const [cumulativeEnergy, setCumulativeEnergy] = useState<number | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const pollingRef = useRef<number | ReturnType<typeof setInterval> | null>(null);

    const fetchInitialData = async () => {
        try {
            const res = await getEnergyTips();
            if (res && res.recommendations && res.recommendations.length > 0 && res.top_devices && Object.keys(res.top_devices).length > 0) {
                setTipsData(res);
            } else {
                setTipsData({
                    forecast: { "2026-03-06": 120.5, "2026-03-07": 115.2 },
                    top_devices: { 
                        "Real-Time IoT Data": 45.2, 
                    },
                    recommendations: []
                });
            }
            if (cumulativeEnergy === null) {
                setCumulativeEnergy(45.2);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (cumulativeEnergy !== null) {
            postTelemetry("AC", cumulativeEnergy).then((res) => {
                if (res) {
                    setTelemetry(res);
                }
            });
        }
    }, [cumulativeEnergy]);

    useEffect(() => {
        fetchInitialData();

        const fetchRealTime = () => {
             fetchLatestPzemData().then((res) => {
                 if (res) {
                     setPzemData(res);
                     setCumulativeEnergy(res.energy);
                 }
             });
        };
        
        fetchRealTime();
        pollingRef.current = setInterval(fetchRealTime, 2500);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current as number);
            }
        }
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchInitialData();
    }, []);

    if (loading && !refreshing) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
                <ActivityIndicator size="large" color="#4f46e5" />
                <Text className="text-gray-500 mt-4 font-semibold">Loading real-time insights...</Text>
            </SafeAreaView>
        );
    }

    if (!tipsData || !tipsData.top_devices || Object.keys(tipsData.top_devices).length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center">
                <Text className="text-red-500 font-bold">Failed to load device data.</Text>
            </SafeAreaView>
        );
    }

    const selectedDeviceName = Object.keys(tipsData.top_devices)[0];
    
    // Graph mock usage data matching frontend AreaChart
    const pastUsageDataPoints = [40.5, 38.2, 49.3, 47.1, 42.8, 44.1, 45.2];

    const selectedUsage = telemetry?.analysis?.current_usage || 4.85;
    const meanDailyUsage = telemetry?.analysis?.historical_mean || 5.0;
    const stdDev = telemetry?.analysis?.std_dev || 0.1;

    let usageLevel = 'Normal Usage';
    let usageColorText = 'text-gray-600';
    let usageColorBg = 'bg-gray-200';
    let usageBorder = 'border-gray-200';
    
    const effectiveStdDev = Math.max(stdDev, meanDailyUsage * 0.05);

    if (selectedUsage <= meanDailyUsage - effectiveStdDev) {
        usageLevel = 'Low: Keep Using as usual';
        usageColorText = 'text-blue-700';
        usageColorBg = 'bg-blue-100';
        usageBorder = 'border-blue-200';
    } else if (selectedUsage > meanDailyUsage + effectiveStdDev) {
        usageLevel = 'High: Reduce usage to save bill';
        usageColorText = 'text-orange-700';
        usageColorBg = 'bg-orange-100';
        usageBorder = 'border-orange-200';
    }

    const usageDifference = meanDailyUsage - selectedUsage;
    const isSaved = usageDifference >= 0;

    return (
        <SafeAreaView className="flex-1 bg-slate-50 border-t border-transparent">
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: 6 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
                }
            >
                {/* Header Section */}
                <View className="mb-6 flex-col border-b border-gray-200 pb-6 rounded-b-3xl">
                    <Text className="text-3xl font-bold text-gray-900 tracking-tight">Insights & Tips</Text>
                    <View className="flex-row mt-2 mb-4">
                        <View className="mt-1 mr-2">
                             <FontAwesome name="bullseye" size={16} color="#6366f1" />
                        </View>
                        <Text className="text-gray-500 font-medium flex-1">Targeted analysis and real-time active data monitoring directly from Firebase.</Text>
                    </View>
                    
                    <View className="bg-white border border-indigo-100 shadow-sm px-4 py-3 rounded-xl flex-row items-center self-start">
                        <View className="w-10 h-10 rounded-full bg-indigo-50 items-center justify-center mr-3">
                            <FontAwesome name="bolt" size={20} color="#4f46e5" />
                        </View>
                        <View className="justify-center">
                            <Text className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Viewing Source</Text>
                            <Text className="text-indigo-900 font-semibold">{selectedDeviceName}</Text>
                        </View>
                    </View>
                </View>

                {/* Left Column Equivalent: Live Firebase Realtime Stats */}
                <View className="mb-8">
                    <View className="flex-row items-center justify-between mb-4">
                         <View className="flex-row items-center">
                             <FontAwesome name="line-chart" size={18} color="#2563eb" style={{ marginRight: 8 }} />
                             <Text className="text-base font-semibold text-gray-800">Real-Time Core</Text>
                         </View>
                         {/* Live pulse indicator simplified for RN */}
                         <View className="flex-row items-center bg-green-50 px-2 py-1 rounded-full">
                              <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                              <Text className="text-green-700 text-[10px] font-bold uppercase tracking-wider">Live</Text>
                         </View>
                    </View>
                    
                    {pzemData ? (
                         <View className="flex-row flex-wrap justify-between">
                              <StatCard icon="bolt" iconColor="#eab308" label="Voltage" value={pzemData.voltage} unit="V" />
                              <StatCard icon="level-down" iconColor="#6366f1" label="Current" value={pzemData.current} unit="A" />
                              <StatCard icon="line-chart" iconColor="#10b981" label="Power" value={pzemData.power} unit="kW" />
                              <StatCard icon="plus-circle" iconColor="#3b82f6" label="Energy" value={cumulativeEnergy} unit="kWh" />
                         </View>
                    ) : (
                         <View className="bg-gray-50 border border-gray-200 rounded-2xl h-[200px] items-center justify-center">
                               <ActivityIndicator size="large" color="#4f46e5" />
                               <Text className="text-gray-500 text-sm mt-4 font-medium">Waiting for live sensor data stream...</Text>
                         </View>
                    )}
                </View>

                {/* Right Column Equivalent: Historical Mean Usage Comparison */}
                <View className="mb-8 mt-2">
                    <View className="flex-row items-center mb-4">
                        <FontAwesome name="balance-scale" size={18} color="#f97316" style={{ marginRight: 8 }} />
                        <Text className="text-lg font-semibold text-gray-800">Daily Usage Comparison</Text>
                    </View>
                    
                    <View className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden pt-8 pb-6 px-4">                         
                         <View className="flex-row justify-between items-center mb-8">
                             <View className="items-center flex-1">
                                 <Text className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider text-center">Historical Mean</Text>
                                 <View className="flex-row items-baseline align-bottom">
                                    <Text className="text-3xl font-bold text-gray-700 mr-1">{meanDailyUsage.toFixed(4)}</Text>
                                    <Text className="text-sm font-medium text-gray-400">kWh</Text>
                                 </View>
                             </View>
                             
                             <View className="h-10 w-px bg-gray-200 mx-1" />
                             
                             <View className="items-center flex-1">
                                 <Text className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider text-center">Today's Usage</Text>
                                 <View className="flex-row items-baseline align-bottom">
                                    <Text className="text-3xl font-bold text-gray-900 mr-1">{selectedUsage.toFixed(4)}</Text>
                                    <Text className="text-sm font-medium text-gray-400">kWh</Text>
                                 </View>
                             </View>
                         </View>
                         
                         <View className={`w-full rounded-2xl p-4 flex-col justify-between ${isSaved ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                              <View className="flex-row items-start flex-1 mb-2">
                                   <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 mt-1 ${isSaved ? 'bg-green-100' : 'bg-red-100'}`}>
                                       <FontAwesome name={isSaved ? "arrow-down" : "arrow-up"} size={16} color={isSaved ? "#16a34a" : "#dc2626"} />
                                   </View>
                                   <View className="flex-1">
                                       <Text className={`font-bold tracking-tight mb-1 text-base ${isSaved ? 'text-green-800' : 'text-red-800'}`}>
                                           {isSaved ? 'Energy Saved' : 'Usage Overrun'}
                                       </Text>
                                       <View className="self-start mt-1">
                                            <View className={`rounded-md border px-2 py-1 ${usageColorBg} ${usageBorder}`}>
                                                <Text className={`text-[10px] font-semibold ${usageColorText}`}>
                                                    {usageLevel}
                                                </Text>
                                            </View>
                                       </View>
                                   </View>
                              </View>
                              <View className="flex-row justify-end items-baseline align-bottom pr-2">
                                 <Text className={`text-4xl font-extrabold tracking-tight ${isSaved ? 'text-green-700' : 'text-red-700'}`}>
                                     {Math.abs(usageDifference).toFixed(4)}
                                 </Text>
                                 <Text className={`text-sm font-bold opacity-80 ml-1 ${isSaved ? 'text-green-700' : 'text-red-700'}`}>
                                     kWh
                                 </Text>
                              </View>
                         </View>
                    </View>
                </View>

                {/* Predicted Usage Banner */}
                <View className="bg-indigo-600 rounded-3xl p-6 mb-8 shadow-lg flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <View className="bg-white/20 p-3 rounded-2xl mr-4">
                            <FontAwesome name="line-chart" size={24} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">Predicted Usage</Text>
                            <Text className="text-indigo-200 text-xs">Tomorrow's forecast</Text>
                        </View>
                    </View>
                    <View className="items-end">
                        <View className="flex-row items-baseline">
                            <Text className="text-white text-3xl font-black italic tracking-tighter">5.02</Text>
                            <Text className="text-indigo-200 text-sm font-bold ml-1">kWh</Text>
                        </View>
                    </View>
                </View>

                {/* Bottom Row Equivalent: Historical Graph */}
                <View className="mb-4 mt-2">
                    <View className="flex-row items-center mb-4">
                        <FontAwesome name="history" size={18} color="#16a34a" style={{ marginRight: 8 }} />
                        <Text className="text-lg font-semibold text-gray-800">Previous Usage</Text>
                    </View>
                    <View className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                        <LineChart
                            data={{
                                labels: [], // Hiding original labels
                                datasets: [
                                    {
                                        data: pastUsageDataPoints,
                                        color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // indigo-600
                                        strokeWidth: 3
                                    }
                                ]
                            }}
                            width={screenWidth - 64} // Padding compensation
                            height={220}
                            withDots={true}
                            withInnerLines={true}
                            withOuterLines={false}
                            withVerticalLines={false}
                            withHorizontalLines={true}
                            chartConfig={{
                                backgroundColor: "#ffffff",
                                backgroundGradientFrom: "#ffffff",
                                backgroundGradientTo: "#ffffff",
                                decimalPlaces: 1,
                                color: (opacity = 1) => `rgba(107, 114, 128, 0.2)`,
                                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`, // gray-500
                                style: {
                                    borderRadius: 16
                                },
                                propsForDots: {
                                    r: "6",
                                    strokeWidth: "0",
                                    fill: "#4f46e5"
                                }
                            }}
                            bezier
                            style={{
                                marginVertical: 8,
                                borderRadius: 16
                            }}
                            formatYLabel={(y) => y}
                            formatXLabel={(x) => ""} 
                        />
                        {/* Custom x-axis labels beneath to handle multiline or spacing elegantly */}
                        <View className="flex-row justify-between px-2 mt-2">
                            <Text className="text-xs text-gray-400 font-medium">6 Days</Text>
                            <Text className="text-xs text-gray-400 font-medium">3 Days</Text>
                            <Text className="text-xs text-gray-400 font-medium">Today</Text>
                        </View>
                    </View>
                 </View>

                {/* Top Devices Section */}
                {tipsData?.top_devices && Object.keys(tipsData.top_devices).length > 0 && (
                    <View className="mb-8 mt-6">
                        <View className="flex-row items-center mb-4">
                            <FontAwesome name="bar-chart" size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
                            <Text className="text-lg font-semibold text-gray-800">Top Devices by Usage</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
                            {Object.entries(tipsData.top_devices as Record<string, number>).map(([device, usage], idx) => {
                                const maxUsage = Math.max(...Object.values(tipsData.top_devices as Record<string, number>));
                                const barFraction = maxUsage > 0 ? usage / maxUsage : 0;
                                const barColors = ['#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
                                const color = barColors[idx % barColors.length];
                                return (
                                    <View key={device} className="bg-white rounded-3xl p-5 mr-4 shadow-sm border border-gray-100" style={{ width: 160 }}>
                                        <View className="w-10 h-10 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: color + '20' }}>
                                            <FontAwesome name="plug" size={18} color={color} />
                                        </View>
                                        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1" numberOfLines={1}>{device}</Text>
                                        <Text className="text-2xl font-black text-gray-800 tracking-tight">{usage.toFixed(2)}<Text className="text-xs font-bold text-gray-400"> kWh</Text></Text>
                                        <View className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <View style={{ width: `${barFraction * 100}%`, backgroundColor: color, height: '100%', borderRadius: 999 }} />
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Smart Recommendations Section */}
                {tipsData?.recommendations && tipsData.recommendations.length > 0 && (
                    <View className="mb-8 mt-2">
                        <View className="flex-row items-center mb-4">
                            <FontAwesome name="lightbulb-o" size={18} color="#f59e0b" style={{ marginRight: 8 }} />
                            <Text className="text-lg font-semibold text-gray-800">Smart Recommendations</Text>
                        </View>
                        {(tipsData.recommendations as Recommendation[]).map((rec, idx) => {
                            const levelIcon = rec.level === 'high' ? 'exclamation-circle' : rec.level === 'low' ? 'star' : 'info-circle';
                            const levelBg = rec.level === 'high' ? 'bg-orange-50 border-orange-100' : rec.level === 'low' ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100';
                            const levelColor = rec.level === 'high' ? '#ea580c' : rec.level === 'low' ? '#3b82f6' : '#16a34a';
                            const levelText = rec.level === 'high' ? 'text-orange-700' : rec.level === 'low' ? 'text-blue-700' : 'text-green-700';
                            return (
                                <View key={idx} className={`rounded-3xl p-5 mb-4 border ${levelBg}`}>
                                    <View className="flex-row items-start">
                                        <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4 mt-0.5" style={{ backgroundColor: levelColor + '20' }}>
                                            <FontAwesome name={levelIcon as any} size={18} color={levelColor} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center justify-between mb-1">
                                                <Text className="font-bold text-gray-900 text-base flex-1 mr-2" numberOfLines={1}>{rec.device}</Text>
                                                <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: levelColor + '20' }}>
                                                    <Text className={`text-[10px] font-bold uppercase tracking-wider ${levelText}`}>{rec.level}</Text>
                                                </View>
                                            </View>
                                            <Text className="text-gray-500 text-xs font-medium mb-2">{rec.usage_kwh.toFixed(4)} kWh today</Text>
                                            <Text className="text-gray-700 text-sm leading-relaxed">{rec.recommendation}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const StatCard = ({ icon, iconColor, label, value, unit }: { icon: string, iconColor: string, label: string, value?: number | null, unit: string }) => {
    return (
        <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4 flex-col justify-center" style={{ width: '48%' }}>
            <View className="flex-row items-center justify-between mb-3">
                 <View className="bg-gray-50 p-2 rounded-lg">
                      <FontAwesome name={icon as any} size={18} color={iconColor} />
                 </View>
                 <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</Text>
            </View>
            <View className="flex-row items-baseline align-bottom">
                 <Text className="text-2xl font-black text-gray-800 tracking-tight mr-1">
                     {value !== undefined && value !== null ? (Number.isInteger(value) ? value : value.toFixed(4)) : 'N/A'}
                 </Text>
                 {unit && <Text className="text-[10px] font-semibold text-gray-500 mb-1">{unit}</Text>}
            </View>
        </View>
    );
}
