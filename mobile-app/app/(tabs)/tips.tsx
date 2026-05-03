import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Dimensions, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getEnergyTips, fetchLatestSensorData, postTelemetry, RealTimeSensorData, TelemetryResponse } from '../../services/api';

interface Recommendation {
    device: string;
    usage_kwh: number;
    level: string;
    recommendation: string;
}

const screenWidth = Dimensions.get('window').width;

export default function Tips() {
    const [tipsData, setTipsData] = useState<any>(null);
    const [realTimeData, setRealTimeData] = useState<RealTimeSensorData | null>(null);
    const [cumulativeEnergy, setCumulativeEnergy] = useState<number | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const pollingRef = useRef<number | ReturnType<typeof setInterval> | null>(null);

    const fetchInitialData = async () => {
        try {
            const res = await getEnergyTips();
            if (res) {
                const useFallback = !res.recommendations || res.recommendations.length === 0 || !res.top_devices || Object.keys(res.top_devices).length === 0;
                
                setTipsData({
                    forecast: res.forecast || { today: 0, tomorrow: 0 },
                    recommendations: res.recommendations || []
                });
            } else {
                setTipsData({
                    forecast: { today: 0, tomorrow: 0 },
                    recommendations: []
                });
            }
            if (cumulativeEnergy === null) {
                setCumulativeEnergy(45.2);
            }
        } catch (error: any) {
            console.error('[Tips] Error in fetchInitialData:', error.message || error);
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
                } else {
                    console.warn('[Tips] Telemetry update returned no analysis');
                }
            }).catch(err => {
                console.error('[Tips] Telemetry update failed:', err.message);
            });
        }
    }, [cumulativeEnergy]);

    useEffect(() => {
        fetchInitialData();

        const fetchRealTime = () => {
             fetchLatestSensorData().then((res) => {
                 if (res) {
                     setRealTimeData(res);
                     if (res.pzem) {
                         setCumulativeEnergy(res.pzem.energy);
                     }
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
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text className="text-slate-400 mt-4 font-semibold">Loading real-time insights...</Text>
            </SafeAreaView>
        );
    }

    if (!tipsData) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <Text className="text-rose-500 font-bold">Failed to load device data.</Text>
            </SafeAreaView>
        );
    }

    const selectedDeviceName = "AC Main";
    
    const selectedUsage = telemetry?.analysis?.current_usage || 4.85;
    const meanDailyUsage = telemetry?.analysis?.historical_mean || 5.0;
    const stdDev = telemetry?.analysis?.std_dev || 0.1;

    let usageLevel = 'Normal Usage';
    let usageColorText = 'text-slate-400';
    let usageColorBg = 'bg-slate-800';
    let usageBorder = 'border-slate-700';
    
    const effectiveStdDev = Math.max(stdDev, meanDailyUsage * 0.05);

    if (selectedUsage <= meanDailyUsage - effectiveStdDev) {
        usageLevel = 'Low: Keep Using as usual';
        usageColorText = 'text-blue-400';
        usageColorBg = 'bg-blue-900/30';
        usageBorder = 'border-blue-500/30';
    } else if (selectedUsage > meanDailyUsage + effectiveStdDev) {
        usageLevel = 'High: Reduce usage to save bill';
        usageColorText = 'text-orange-400';
        usageColorBg = 'bg-orange-900/30';
        usageBorder = 'border-orange-500/30';
    } else {
        usageLevel = 'Normal Usage';
        usageColorText = 'text-slate-400';
        usageColorBg = 'bg-slate-800';
        usageBorder = 'border-slate-700';
    }

    const usageDifference = meanDailyUsage - selectedUsage;
    const isSaved = usageDifference >= 0;

    const formatCurrent = (val?: number) => {
        if (val === undefined || val === null) return { v: val, u: "A" };
        if (val > 0 && val < 1) return { v: val * 1000, u: "mA" };
        return { v: val, u: "A" };
    };

    const formatPower = (val?: number) => {
        if (val === undefined || val === null) return { v: val, u: "W" };
        if (val > 0 && val < 1) return { v: val * 1000, u: "W" };
        return { v: val, u: "W" };
    };

    const formatEnergy = (val?: number) => {
        if (val === undefined || val === null) return { v: val, u: "Wh" };
        if (val > 0 && val < 0.001) return { v: val * 1000000, u: "mWh" };
        if (val >= 0.001 && val < 1) return { v: val * 1000, u: "Wh" };
        return { v: val, u: "Wh" };
    };

    const currentFmt = formatCurrent(realTimeData?.pzem?.current);
    const powerFmt = formatPower(realTimeData?.pzem?.power);
    const energyFmt = formatEnergy(realTimeData?.pzem?.energy);

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                className="flex-1"
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ padding: 20, paddingBottom: 40, paddingTop: 20 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                >
                    {/* Header Section */}
                    <View className="mb-6 flex-col border-b border-white/10 pb-6">
                        <Text className="text-3xl font-black text-white tracking-tight">Insights & Tips</Text>
                        <View className="flex-row mt-2 mb-4">
                            <View className="mt-1 mr-2">
                                 <FontAwesome name="bullseye" size={16} color="#38bdf8" />
                            </View>
                            <Text className="text-slate-400 font-medium flex-1">Targeted analysis and real-time active data monitoring directly from Firebase.</Text>
                        </View>
                        
                        <View className="bg-slate-800/80 border border-white/5 shadow-sm px-4 py-3 rounded-2xl flex-row items-center self-start">
                            <View className="w-10 h-10 rounded-full bg-indigo-500/20 items-center justify-center mr-3">
                                <FontAwesome name="bolt" size={20} color="#818cf8" />
                            </View>
                            <View className="justify-center">
                                <Text className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Viewing Source</Text>
                                <Text className="text-white font-semibold">{selectedDeviceName}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Left Column Equivalent: Live Firebase Realtime Stats */}
                    <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-4">
                             <View className="flex-row items-center">
                                 <FontAwesome name="line-chart" size={18} color="#38bdf8" style={{ marginRight: 8 }} />
                                 <Text className="text-lg font-bold text-white">Real-Time Core</Text>
                             </View>
                             {/* Live pulse indicator simplified for RN */}
                             <View className="flex-row items-center bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-500/30">
                                  <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
                                  <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Live</Text>
                             </View>
                        </View>
                        
                        {realTimeData ? (
                             <View className="flex-row flex-wrap justify-between">
                                  <StatCard icon="bolt" iconColor="#facc15" label="Voltage" value={realTimeData.pzem?.voltage} unit="V" />
                                  <StatCard icon="level-down" iconColor="#22d3ee" label="Current" value={currentFmt.v} unit={currentFmt.u} />
                                  <StatCard icon="line-chart" iconColor="#34d399" label="Power" value={powerFmt.v} unit={powerFmt.u} />
                                  <StatCard icon="plus-circle" iconColor="#60a5fa" label="Energy" value={energyFmt.v} unit={energyFmt.u} />
                                  <StatCard icon="thermometer" iconColor="#fb7185" label="Temp" value={realTimeData.si7021?.temperature} unit="°C" />
                                  <StatCard icon="tint" iconColor="#22d3ee" label="Humidity" value={realTimeData.si7021?.humidity} unit="%" />
                                  <StatCard icon="battery-full" iconColor="#4ade80" label="Battery V" value={realTimeData.ina3221?.battery?.voltage} unit="V" />
                                  <StatCard icon="wifi" iconColor="#c084fc" label="Signal" value={realTimeData.system?.rssi} unit="dBm" />
                             </View>
                        ) : (
                             <View className="bg-slate-800/50 border border-white/5 rounded-3xl h-[200px] items-center justify-center">
                                   <ActivityIndicator size="large" color="#38bdf8" />
                                   <Text className="text-slate-400 text-sm mt-4 font-medium">Waiting for live sensor data stream...</Text>
                             </View>
                        )}
                    </View>

                    {/* Right Column Equivalent: Historical Mean Usage Comparison */}
                    <View className="mb-8 mt-2">
                        <View className="flex-row items-center mb-4">
                            <FontAwesome name="balance-scale" size={18} color="#fb923c" style={{ marginRight: 8 }} />
                            <Text className="text-lg font-bold text-white">Daily Usage Comparison</Text>
                        </View>
                        
                        <View className="bg-slate-800/80 rounded-3xl shadow-lg border border-white/5 overflow-hidden pt-8 pb-6 px-4">                         
                             <View className="flex-row justify-between items-center mb-8">
                                 <View className="items-center flex-1">
                                     <Text className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider text-center">Historical Mean</Text>
                                     <View className="flex-row items-baseline align-bottom">
                                        <Text className="text-3xl font-bold text-white mr-1">{meanDailyUsage.toFixed(2)}</Text>
                                        <Text className="text-sm font-medium text-slate-400">kWh</Text>
                                     </View>
                                 </View>
                                 
                                 <View className="h-10 w-px bg-white/10 mx-1" />
                                 
                                 <View className="items-center flex-1">
                                     <Text className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider text-center">Today's Usage</Text>
                                     <View className="flex-row items-baseline align-bottom">
                                        <Text className="text-3xl font-bold text-white mr-1">{selectedUsage.toFixed(2)}</Text>
                                        <Text className="text-sm font-medium text-slate-400">kWh</Text>
                                     </View>
                                 </View>
                             </View>
                             
                             <View className={`w-full rounded-2xl p-4 flex-col justify-between border ${isSaved ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                  <View className="flex-row items-start flex-1 mb-2">
                                       <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 mt-1 ${isSaved ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                           <FontAwesome name={isSaved ? "arrow-down" : "arrow-up"} size={16} color={isSaved ? "#34d399" : "#fb7185"} />
                                       </View>
                                       <View className="flex-1">
                                           <Text className={`font-bold tracking-tight mb-1 text-base ${isSaved ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                                     <Text className={`text-4xl font-extrabold tracking-tight ${isSaved ? 'text-emerald-400' : 'text-rose-400'}`}>
                                         {Math.abs(usageDifference).toFixed(2)}
                                     </Text>
                                     <Text className={`text-sm font-bold opacity-80 ml-1 ${isSaved ? 'text-emerald-500' : 'text-rose-500'}`}>
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
                                <Text className="text-white text-3xl font-black italic tracking-tighter">
                                    {tipsData?.forecast?.tomorrow ? Number(tipsData.forecast.tomorrow).toFixed(2) : '5.02'}
                                </Text>
                                <Text className="text-indigo-200 text-sm font-bold ml-1">kWh</Text>
                            </View>
                        </View>
                    </View>


                    {/* Smart Recommendations Section */}
                    {tipsData?.recommendations && tipsData.recommendations.length > 0 && (
                        <View className="mb-8 mt-2">
                            <View className="flex-row items-center mb-4">
                                <FontAwesome name="lightbulb-o" size={18} color="#facc15" style={{ marginRight: 8 }} />
                                <Text className="text-lg font-bold text-white">Smart Recommendations</Text>
                            </View>
                            {(tipsData.recommendations as Recommendation[]).map((rec, idx) => {
                                const levelIcon = rec.level === 'high' ? 'exclamation-circle' : rec.level === 'low' ? 'star' : 'info-circle';
                                const levelBg = rec.level === 'high' ? 'bg-orange-500/10 border-orange-500/20' : rec.level === 'low' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-green-500/10 border-green-500/20';
                                const levelColor = rec.level === 'high' ? '#fb923c' : rec.level === 'low' ? '#60a5fa' : '#4ade80';
                                const levelText = rec.level === 'high' ? 'text-orange-400' : rec.level === 'low' ? 'text-blue-400' : 'text-green-400';
                                return (
                                    <View key={idx} className={`rounded-3xl p-5 mb-4 border ${levelBg} backdrop-blur-sm`}>
                                        <View className="flex-row items-start">
                                            <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4 mt-0.5" style={{ backgroundColor: levelColor + '20' }}>
                                                <FontAwesome name={levelIcon as any} size={18} color={levelColor} />
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center justify-between mb-1">
                                                    <Text className="font-bold text-white text-base flex-1 mr-2" numberOfLines={1}>{rec.device}</Text>
                                                    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: levelColor + '20' }}>
                                                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${levelText}`}>{rec.level}</Text>
                                                    </View>
                                                </View>
                                                <Text className="text-slate-400 text-xs font-medium mb-2">{rec.usage_kwh.toFixed(2)} kWh today</Text>
                                                <Text className="text-slate-300 text-sm leading-relaxed">{rec.recommendation}</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const StatCard = ({ icon, iconColor, label, value, unit }: { icon: string, iconColor: string, label: string, value?: number | null, unit: string }) => {
    return (
        <View className="bg-slate-800/80 p-4 rounded-3xl mb-4 shadow-lg border border-white/5 backdrop-blur-sm flex-col justify-center" style={{ width: '48%' }}>
            <View className="flex-row items-center justify-between mb-3">
                 <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: iconColor + '20' }}>
                      <FontAwesome name={icon as any} size={18} color={iconColor} />
                 </View>
                 <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
            </View>
            <View className="flex-row items-baseline align-bottom">
                 <Text className="text-3xl font-black text-white tracking-tight mr-1">
                     {value !== undefined && value !== null ? (Number.isInteger(value) ? value : value.toFixed(2)) : '--'}
                 </Text>
                 {unit && <Text className="text-sm font-bold text-slate-400 mb-1">{unit}</Text>}
            </View>
        </View>
    );
}
