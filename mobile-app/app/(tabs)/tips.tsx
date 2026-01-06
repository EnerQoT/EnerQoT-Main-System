import React from 'react';
import { View, Text, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function Tips() {
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
                            Energy Tips
                        </Text>
                        <Text className="text-slate-300 font-semibold text-sm mt-1">
                            AI-Powered Recommendations
                        </Text>
                    </View>

                    {/* Efficiency Score */}
                    <View className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-6 mb-6 shadow-xl">
                        <Text className="text-white/80 font-bold text-xs uppercase tracking-wider mb-2">
                            Your Efficiency Score
                        </Text>
                        <View className="flex-row items-end">
                            <Text className="text-white text-6xl font-black">78</Text>
                            <Text className="text-white/60 text-2xl font-bold mb-2">/100</Text>
                        </View>
                        <View className="bg-white/20 rounded-full h-3 mt-4 overflow-hidden">
                            <View className="bg-slate-400 h-full rounded-full" style={{ width: '78%' }} />
                        </View>
                        <Text className="text-white/80 font-medium text-sm mt-3">
                            Good! You're doing better than 65% of users
                        </Text>
                    </View>

                    {/* Savings Potential */}
                    <View className="bg-green-600 rounded-3xl p-5 mb-6 flex-row items-center shadow-lg">
                        <View className="bg-white/20 p-3 rounded-2xl mr-4">
                            <FontAwesome name="dollar" size={28} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-black text-2xl">~15% Savings</Text>
                            <Text className="text-white/80 font-medium text-sm mt-1">
                                Potential monthly reduction
                            </Text>
                        </View>
                    </View>

                    {/* Recommendations */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Personalized Tips</Text>

                    <TipCard
                        icon="clock-o"
                        color="#f59e0b"
                        title="Peak Usage Detected"
                        description="Your consumption spikes between 8-10 PM. Consider shifting heavy appliances to off-peak hours to reduce costs."
                        priority="HIGH"
                    />

                    <TipCard
                        icon="flash"
                        color="#ef4444"
                        title="Low Power Factor"
                        description="Your power factor is averaging 0.75. Check for inductive loads like motors or transformers that may need correction."
                        priority="MEDIUM"
                    />

                    <TipCard
                        icon="thermometer-half"
                        color="#f97316"
                        title="Temperature Alert"
                        description="Temperature rises during high load periods. Ensure proper ventilation around electrical equipment."
                        priority="MEDIUM"
                    />

                    <TipCard
                        icon="lightbulb-o"
                        color="#22c55e"
                        title="Energy Optimization"
                        description="Your voltage fluctuations are minimal. Great job maintaining stable power quality!"
                        priority="LOW"
                    />

                    <TipCard
                        icon="line-chart"
                        color="#3b82f6"
                        title="Usage Pattern"
                        description="Your consumption is 12% lower than last month. Keep up the good work!"
                        priority="LOW"
                    />

                    {/* Usage Patterns */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mt-4 mb-20">
                        <Text className="text-white font-bold text-lg mb-4">Daily Usage Pattern</Text>
                        <View className="flex-row items-end justify-between h-40">
                            {[30, 45, 40, 55, 50, 70, 85, 95, 90, 75, 60, 50].map((height, index) => (
                                <View key={index} className="flex-1 items-center">
                                    <View
                                        className="bg-blue-500 w-full rounded-t-lg"
                                        style={{ height: `${height}%` }}
                                    />
                                    <Text className="text-slate-400 text-[10px] mt-2">{index * 2}h</Text>
                                </View>
                            ))}
                        </View>
                        <Text className="text-slate-400 text-xs mt-4 text-center">
                            Average hourly consumption (kWh)
                        </Text>
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const TipCard = ({ icon, color, title, description, priority }: any) => {
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
        <View className={`rounded-2xl p-4 mb-3 border ${priorityColors[priority]}`}>
            <View className="flex-row items-start">
                <View className="mr-3 mt-1">
                    <FontAwesome name={icon} size={22} color={color} />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-white font-bold text-base flex-1">{title}</Text>
                        <Text className={`${priorityTextColors[priority]} text-xs font-bold uppercase`}>
                            {priority}
                        </Text>
                    </View>
                    <Text className="text-slate-300 text-sm leading-5">{description}</Text>
                </View>
            </View>
        </View>
    );
};
