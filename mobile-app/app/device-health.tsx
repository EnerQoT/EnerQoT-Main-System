import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function DeviceHealth() {
    const router = useRouter();

    const healthMetrics = [
        { label: 'CPU Usage', value: 45, unit: '%', status: 'good', icon: 'microchip', color: '#10b981' },
        { label: 'Memory', value: 62, unit: '%', status: 'warning', icon: 'database', color: '#f59e0b' },
        { label: 'Network', value: 98, unit: '%', status: 'good', icon: 'wifi', color: '#10b981' },
        { label: 'Storage', value: 78, unit: '%', status: 'warning', icon: 'hdd-o', color: '#f59e0b' },
        { label: 'Battery', value: 85, unit: '%', status: 'good', icon: 'battery-three-quarters', color: '#10b981' },
        { label: 'Temperature', value: 42, unit: '°C', status: 'good', icon: 'thermometer-half', color: '#10b981' },
    ];

    const systemInfo = [
        { label: 'OS Version', value: 'Android 13' },
        { label: 'App Version', value: '1.0.0' },
        { label: 'Build Number', value: '2024.01.001' },
        { label: 'Last Update', value: '2 days ago' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                className="flex-1"
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View className="flex-row items-center mb-8 mt-2">
                        <TouchableOpacity onPress={() => router.back()} className="bg-white/10 p-2 rounded-full mr-4">
                            <FontAwesome name="arrow-left" size={20} color="white" />
                        </TouchableOpacity>
                        <Text className="text-2xl font-extrabold text-white">Device Health</Text>
                    </View>

                    {/* Overall Status */}
                    <View className="bg-green-600 rounded-3xl p-6 mb-6 flex-row items-center">
                        <View className="bg-white/20 p-3 rounded-2xl mr-4">
                            <FontAwesome name="check-circle" size={32} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-black text-2xl">Healthy</Text>
                            <Text className="text-white/80 font-medium text-sm mt-1">
                                All systems operational
                            </Text>
                        </View>
                    </View>

                    {/* Health Metrics */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">System Metrics</Text>
                    <View className="flex-row flex-wrap justify-between mb-6">
                        {healthMetrics.map((metric, index) => (
                            <View key={index} className="bg-slate-800/80 w-[48%] p-4 rounded-2xl mb-3 border border-white/5">
                                <View className="flex-row items-center justify-between mb-2">
                                    <FontAwesome name={metric.icon as any} size={20} color={metric.color} />
                                    <View className={`px-2 py-1 rounded-full ${metric.status === 'good' ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                                        <Text className={`text-[10px] font-bold ${metric.status === 'good' ? 'text-green-400' : 'text-amber-400'}`}>
                                            {metric.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-2xl font-black text-white">
                                    {metric.value}
                                    <Text className="text-sm text-slate-400 font-bold">{metric.unit}</Text>
                                </Text>
                                <Text className="text-slate-400 text-xs font-bold uppercase mt-1">{metric.label}</Text>
                            </View>
                        ))}
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
                    <TouchableOpacity className="bg-blue-600 rounded-2xl p-4 flex-row items-center justify-center mb-20">
                        <FontAwesome name="refresh" size={20} color="white" />
                        <Text className="text-white font-bold text-base ml-3">Run Diagnostics</Text>
                    </TouchableOpacity>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}
