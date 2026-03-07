import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getNotifications } from '../../services/api';

export default function Notifications() {
    const [filter, setFilter] = useState('All');
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const filters = ['All', 'Critical', 'Warning', 'Normal', 'Actions'];

    const fetchData = async () => {
        try {
            const result = await getNotifications('test_device_01');
            if (result && result.notifications) {
                setNotifications(result.notifications);
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Poll slowly for new notifications
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'All') return true;
        if (filter === 'Actions') return notif.action !== 'None';
        return notif.severity === filter.toUpperCase();
    });

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
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6 mt-2">
                        <View>
                            <Text className="text-3xl font-extrabold text-white tracking-tight">
                                Notifications
                            </Text>
                            <Text className="text-slate-300 font-semibold text-sm mt-1">
                                {filteredNotifications.filter(n => !n.read).length} unread alerts
                            </Text>
                        </View>
                        <TouchableOpacity className="bg-slate-800/80 px-4 py-2 rounded-xl border border-white/10">
                            <Text className="text-blue-400 font-semibold text-sm">Clear All</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Filter Chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-6"
                        contentContainerStyle={{ paddingRight: 20 }}
                    >
                        {filters.map((f) => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setFilter(f)}
                                className={`mr-2 px-4 py-2 rounded-full ${filter === f ? 'bg-blue-600' : 'bg-slate-800/80 border border-white/10'
                                    }`}
                            >
                                <Text className={`font-bold text-sm ${filter === f ? 'text-white' : 'text-slate-400'}`}>
                                    {f}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View className="mb-20">
                        {loading && !refreshing ? (
                            <View className="py-20 justify-center items-center">
                                <ActivityIndicator size="large" color="#3b82f6" />
                                <Text className="text-slate-400 mt-4">Loading alerts...</Text>
                            </View>
                        ) : filteredNotifications.length === 0 ? (
                            <View className="py-20 justify-center items-center">
                                <View className="bg-white/5 w-20 h-20 justify-center items-center rounded-full mb-4">
                                    <FontAwesome name="bell-slash-o" size={32} color="#64748b" />
                                </View>
                                <Text className="text-white font-bold text-lg">No Notifications</Text>
                                <Text className="text-slate-500 text-center mt-2 mx-8">
                                    You have no alerts matching this filter criteria.
                                </Text>
                            </View>
                        ) : (
                            filteredNotifications.map((notif: any, i: number) => (
                                <NotificationCard key={notif.id || i} notification={notif} />
                            ))
                        )}
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const NotificationCard = ({ notification }: any) => {
    const { severity, title, message, action, time, read } = notification;

    const severityConfig: any = {
        CRITICAL: {
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/30',
            badge: 'bg-rose-500',
            icon: 'warning',
            iconColor: '#f43f5e'
        },
        WARNING: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            badge: 'bg-amber-500',
            icon: 'exclamation-triangle',
            iconColor: '#f59e0b'
        },
        NORMAL: {
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            badge: 'bg-blue-500',
            icon: 'check-circle',
            iconColor: '#3b82f6'
        }
    };

    const config = severityConfig[severity];

    return (
        <View className={`${config.bg} rounded-2xl p-4 mb-3 border ${config.border} ${!read ? 'border-l-4' : ''}`}>
            <View className="flex-row items-start">
                <View className="mr-3 mt-1">
                    <FontAwesome name={config.icon} size={22} color={config.iconColor} />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-start justify-between mb-2">
                        <Text className="text-white font-bold text-base flex-1 pr-2">{title}</Text>
                        {!read && (
                            <View className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        )}
                    </View>
                    <Text className="text-slate-300 text-sm leading-5 mb-3">{message}</Text>

                    {action !== 'None' && (
                        <View className="bg-black/20 rounded-xl p-2 mb-2 flex-row items-center">
                            <FontAwesome name="cog" size={12} color="#94a3b8" />
                            <Text className="text-slate-300 text-xs ml-2 font-medium">Action: {action}</Text>
                        </View>
                    )}

                    <View className="flex-row items-center justify-between mt-1">
                        <View className="flex-row items-center">
                            <FontAwesome name="clock-o" size={12} color="#94a3b8" />
                            <Text className="text-slate-400 text-xs ml-2">{time}</Text>
                        </View>
                        <View className={`${config.badge} px-2 py-1 rounded-full`}>
                            <Text className="text-white text-[10px] font-bold">{severity}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};
