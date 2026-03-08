import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function Menu() {
    const router = useRouter();

    const menuItems = [
        {
            title: 'Add New Device',
            icon: 'plus',
            color: '#22c55e', // distinct green
            route: '/add-device',
            description: 'Pair a sensor'
        },
        {
            title: 'Profile',
            icon: 'user',
            color: '#3b82f6',
            route: '/profile',
            description: 'Manage your account'
        },
        {
            title: 'Settings',
            icon: 'cog',
            color: '#8b5cf6',
            route: '/settings',
            description: 'App preferences'
        },
        {
            title: 'Device Health',
            icon: 'heartbeat',
            color: '#10b981',
            route: '/device-health',
            description: 'System diagnostics'
        },
        {
            title: 'Energy Analytics',
            icon: 'line-chart',
            color: '#f59e0b',
            route: '/analytics',
            description: 'Detailed insights'
        },
        {
            title: 'Alerts Config',
            icon: 'bell',
            color: '#ef4444',
            route: '/alerts-config',
            description: 'Notification settings'
        },
        {
            title: 'Data Export',
            icon: 'download',
            color: '#06b6d4',
            route: '/data-export',
            description: 'Export reports'
        },
        {
            title: 'Help & Support',
            icon: 'question-circle',
            color: '#ec4899',
            route: '/support',
            description: 'Get assistance'
        },
        {
            title: 'About',
            icon: 'info-circle',
            color: '#6366f1',
            route: '/about',
            description: 'App information'
        }
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
                >
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-8 mt-2">
                        <View>
                            <Text className="text-3xl font-extrabold text-white tracking-tight">
                                Menu
                            </Text>
                            <Text className="text-slate-300 font-semibold text-sm mt-1">
                                Settings & More
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="bg-white/10 p-2 rounded-full"
                        >
                            <FontAwesome name="times" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Menu Grid */}
                    <View className="flex-row flex-wrap justify-between mb-20">
                        {menuItems.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => router.push(item.route as any)}
                                className="bg-slate-800/80 w-[48%] p-5 rounded-3xl mb-4 border border-white/5"
                            >
                                <View
                                    className="w-12 h-12 rounded-2xl justify-center items-center mb-3"
                                    style={{ backgroundColor: item.color + '20' }}
                                >
                                    <FontAwesome name={item.icon as any} size={24} color={item.color} />
                                </View>
                                <Text className="text-white font-bold text-base mb-1">
                                    {item.title}
                                </Text>
                                <Text className="text-slate-400 text-xs">
                                    {item.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}
