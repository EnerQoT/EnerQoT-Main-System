import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LineChart, BarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;

export default function Reports() {
    const [selectedPeriod, setSelectedPeriod] = useState('Daily');

    const periods = ['Daily', 'Weekly', 'Monthly'];

    // Mock data
    const dailyData = [2.1, 2.5, 2.3, 2.8, 2.6, 3.2, 3.5];
    const weeklyData = [18, 22, 20, 25, 23, 28, 26, 30];
    const monthlyData = [450, 480, 520, 490, 510, 540];

    const getData = () => {
        if (selectedPeriod === 'Daily') return dailyData;
        if (selectedPeriod === 'Weekly') return weeklyData;
        return monthlyData;
    };

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

                    {/* Summary Stats */}
                    <View className="flex-row flex-wrap justify-between mb-6">
                        <StatCard
                            icon="bolt"
                            label="Total Energy"
                            value="1,245"
                            unit="kWh"
                            color="#22d3ee"
                        />
                        <StatCard
                            icon="flash"
                            label="Avg Voltage"
                            value="230.5"
                            unit="V"
                            color="#facc15"
                        />
                        <StatCard
                            icon="warning"
                            label="Anomalies"
                            value="12"
                            unit="events"
                            color="#f87171"
                        />
                        <StatCard
                            icon="check-circle"
                            label="Uptime"
                            value="99.8"
                            unit="%"
                            color="#4ade80"
                        />
                    </View>

                    {/* Consumption Trend */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 shadow-lg mb-6 border border-white/10">
                        <Text className="text-lg font-bold text-white mb-4">
                            Energy Consumption Trend
                        </Text>
                        <LineChart
                            data={{
                                labels: selectedPeriod === 'Daily' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
                                    selectedPeriod === 'Weekly' ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'] :
                                        ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                                datasets: [{ data: getData() }]
                            }}
                            width={screenWidth - 80}
                            height={220}
                            withDots={true}
                            withInnerLines={true}
                            withOuterLines={false}
                            withVerticalLines={false}
                            yAxisInterval={1}
                            chartConfig={{
                                backgroundColor: "transparent",
                                backgroundGradientFrom: "#1e293b",
                                backgroundGradientTo: "#1e293b",
                                decimalPlaces: 1,
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
                        <AnomalyEvent
                            severity="CRITICAL"
                            title="Voltage Sag Detected"
                            time="2024-01-05 10:45 PM"
                            action="Power cut initiated"
                        />
                        <AnomalyEvent
                            severity="WARNING"
                            title="High Temperature"
                            time="2024-01-05 08:30 PM"
                            action="Alert sent to admin"
                        />
                        <AnomalyEvent
                            severity="WARNING"
                            title="Overcurrent Event"
                            time="2024-01-04 02:15 PM"
                            action="Load shedding applied"
                        />
                        <AnomalyEvent
                            severity="CRITICAL"
                            title="Frequency Deviation"
                            time="2024-01-03 11:20 AM"
                            action="Emergency shutdown"
                        />
                    </View>

                    {/* Export Button */}
                    <TouchableOpacity className="bg-blue-600 rounded-2xl p-4 flex-row items-center justify-center mb-20">
                        <FontAwesome name="download" size={20} color="white" />
                        <Text className="text-white font-bold text-base ml-3">Download PDF Report</Text>
                    </TouchableOpacity>
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
