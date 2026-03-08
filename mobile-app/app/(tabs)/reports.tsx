import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LineChart } from 'react-native-chart-kit';
import { getReports } from '../../services/api';

const screenWidth = Dimensions.get("window").width;

export default function Reports() {
    const [selectedPeriod, setSelectedPeriod] = useState('Daily');
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any>(null);

    const periods = ['Daily', 'Weekly', 'Monthly'];

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const data = await getReports('test_device_01', selectedPeriod.toLowerCase());
                setReportData(data);
            } catch (error) {
                console.error('Failed to fetch reports', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [selectedPeriod]);

    const getChartData = () => {
        if (!reportData || !reportData.energy_data || reportData.energy_data.length === 0) {
            return [0];
        }
        return reportData.energy_data.map((d: any) =>
            (d.voltage * d.current * d.power_factor) || 0
        ).slice(-30);
    };

    const stats = reportData?.statistics || {};
    const totalEnergy = stats.total_energy_kwh ?? 0;
    const avgVoltage = stats.avg_voltage ?? 0;
    const totalAnomalies = stats.total_anomalies ?? 0;
    const uptimePercentage = stats.uptime_percentage ?? "99.8";

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
                >
                    {/* Header */}
                    <View className="mb-6 mt-2">
                        <Text className="text-3xl font-extrabold text-white tracking-tight">
                            Reports
                        </Text>
                        <Text className="text-slate-300 font-semibold text-sm mt-1">
                            Historical Analysis & Insights
                        </Text>
                    </View>

                    {/* Period Selector */}
                    <View className="flex-row bg-slate-800/80 rounded-2xl p-1 mb-6">
                        {periods.map((period) => (
                            <TouchableOpacity
                                key={period}
                                onPress={() => setSelectedPeriod(period)}
                                className={`flex-1 py-3 rounded-xl ${selectedPeriod === period ? 'bg-blue-600' : ''}`}
                            >
                                <Text className={`text-center font-bold ${selectedPeriod === period ? 'text-white' : 'text-slate-400'}`}>
                                    {period}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {loading ? (
                        <View className="flex-1 justify-center items-center py-20">
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text className="text-slate-400 mt-4 font-bold">Generating report...</Text>
                        </View>
                    ) : (
                        <>
                            {/* Summary Stats */}
                            <View className="flex-row flex-wrap justify-between mb-6">
                                <StatCard icon="bolt" label="Total Energy" value={totalEnergy} unit="kWh" color="#22d3ee" />
                                <StatCard icon="flash" label="Avg Voltage" value={avgVoltage} unit="V" color="#facc15" />
                                <StatCard icon="warning" label="Anomalies" value={totalAnomalies} unit="events" color="#f87171" />
                                <StatCard icon="check-circle" label="Uptime" value={uptimePercentage} unit="%" color="#4ade80" />
                            </View>

                            {/* Consumption Trend */}
                            <View className="bg-slate-800/80 rounded-3xl p-5 shadow-lg mb-6 border border-white/10">
                                <Text className="text-lg font-bold text-white mb-4">
                                    Energy Consumption Trend (W)
                                </Text>
                                <LineChart
                                    data={{
                                        labels: [], // No labels for dense data to preserve cleanliness
                                        datasets: [{ data: getChartData() }]
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
                                        color: (opacity = 1) => `rgba(34, 211, 238, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                        propsForBackgroundLines: {
                                            strokeDasharray: "4",
                                            stroke: "#334155"
                                        },
                                        fillShadowGradientFrom: "#22d3ee",
                                        fillShadowGradientTo: "#1e293b",
                                        fillShadowGradientOpacity: 0.3,
                                    }}
                                    bezier
                                    style={{ borderRadius: 16 }}
                                />
                            </View>

                            {/* Anomaly Timeline */}
                            <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                                <Text className="text-white font-bold text-lg mb-4">Anomaly Timeline</Text>
                                {(!reportData?.anomalies || reportData.anomalies.length === 0) ? (
                                    <Text className="text-slate-400 font-bold self-center py-4">No anomalies in this period</Text>
                                ) : (
                                    reportData.anomalies.map((anomaly: any, index: number) => (
                                        <AnomalyEvent
                                            key={anomaly._id || index}
                                            severity={anomaly.severity}
                                            title={anomaly.message || `${anomaly.severity} Grid Event`}
                                            time={new Date(anomaly.timestamp).toLocaleString()}
                                            action={anomaly.feedback_status === "confirmed" ? "Confirmed by user" :
                                                anomaly.feedback_status === "false_alarm" ? "Marked as False Alarm" : "Pending feedback"}
                                        />
                                    ))
                                )}
                            </View>

                            {/* Export Button */}
                            <TouchableOpacity className="bg-blue-600 rounded-2xl p-4 flex-row items-center justify-center mb-20">
                                <FontAwesome name="download" size={20} color="white" />
                                <Text className="text-white font-bold text-base ml-3">Download PDF Report</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const StatCard = ({ icon, label, value, unit, color }: any) => (
    <View className="bg-slate-800/80 w-[48%] p-4 rounded-2xl mb-3 shadow-lg border border-white/5">
        <FontAwesome name={icon} size={20} color={color} />
        <Text className="text-2xl font-black text-white tracking-tight mt-2">
            {value}
            <Text className="text-sm text-slate-400 ml-1 font-bold">{unit}</Text>
        </Text>
        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{label}</Text>
    </View>
);

const AnomalyEvent = ({ severity, title, time, action }: any) => {
    const severityColor = severity === "CRITICAL" ? "bg-rose-500" : "bg-amber-500";
    const bgColor = severity === "CRITICAL" ? "bg-rose-500/10" : "bg-amber-500/10";

    return (
        <View className={`${bgColor} rounded-xl p-3 mb-3 border-l-4 ${severity === "CRITICAL" ? "border-rose-500" : "border-amber-500"}`}>
            <View className="flex-row items-start justify-between mb-2">
                <Text className="text-white font-bold text-sm flex-1">{title}</Text>
                <View className={`${severityColor} px-2 py-1 rounded-full`}>
                    <Text className="text-white text-[10px] font-bold">{severity}</Text>
                </View>
            </View>
            <Text className="text-slate-400 text-xs mb-2">{time}</Text>
            <View className="flex-row items-center">
                <FontAwesome name="cog" size={12} color="#94a3b8" />
                <Text className="text-slate-300 text-xs ml-2">{action}</Text>
            </View>
        </View>
    );
};
