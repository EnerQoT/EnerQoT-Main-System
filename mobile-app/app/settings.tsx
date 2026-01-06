import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function Settings() {
    const router = useRouter();
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [soundAlerts, setSoundAlerts] = useState(false);

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
                        <Text className="text-2xl font-extrabold text-white">Settings</Text>
                    </View>

                    {/* Appearance */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-4">
                        <Text className="text-white font-bold text-lg mb-4">Appearance</Text>
                        <SettingRow
                            icon="moon-o"
                            label="Dark Mode"
                            value={darkMode}
                            onToggle={setDarkMode}
                        />
                    </View>

                    {/* Notifications */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-4">
                        <Text className="text-white font-bold text-lg mb-4">Notifications</Text>
                        <SettingRow
                            icon="bell"
                            label="Push Notifications"
                            value={notifications}
                            onToggle={setNotifications}
                        />
                        <SettingRow
                            icon="volume-up"
                            label="Sound Alerts"
                            value={soundAlerts}
                            onToggle={setSoundAlerts}
                        />
                    </View>

                    {/* Data & Sync */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-4">
                        <Text className="text-white font-bold text-lg mb-4">Data & Sync</Text>
                        <SettingRow
                            icon="refresh"
                            label="Auto Refresh"
                            value={autoRefresh}
                            onToggle={setAutoRefresh}
                        />
                        <TouchableOpacity className="flex-row items-center justify-between py-3">
                            <View className="flex-row items-center">
                                <FontAwesome name="database" size={18} color="#94a3b8" />
                                <Text className="text-white font-medium ml-3">Clear Cache</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Advanced */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-20">
                        <Text className="text-white font-bold text-lg mb-4">Advanced</Text>
                        <SettingButton icon="shield" label="Privacy & Security" />
                        <SettingButton icon="language" label="Language" value="English" />
                        <SettingButton icon="clock-o" label="Time Zone" value="UTC+5:30" />
                        <SettingButton icon="code" label="Developer Options" />
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const SettingRow = ({ icon, label, value, onToggle }: any) => (
    <View className="flex-row items-center justify-between py-3 border-b border-slate-700/50">
        <View className="flex-row items-center flex-1">
            <FontAwesome name={icon} size={18} color="#94a3b8" />
            <Text className="text-white font-medium ml-3">{label}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: '#334155', true: '#3b82f6' }}
            thumbColor={value ? '#fff' : '#94a3b8'}
        />
    </View>
);

const SettingButton = ({ icon, label, value }: any) => (
    <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-slate-700/50">
        <View className="flex-row items-center flex-1">
            <FontAwesome name={icon} size={18} color="#94a3b8" />
            <Text className="text-white font-medium ml-3">{label}</Text>
        </View>
        <View className="flex-row items-center">
            {value && <Text className="text-slate-400 text-sm mr-2">{value}</Text>}
            <FontAwesome name="chevron-right" size={16} color="#64748b" />
        </View>
    </TouchableOpacity>
);
