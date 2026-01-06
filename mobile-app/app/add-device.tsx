import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function AddDevice() {
    const router = useRouter();

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
                        <Text className="text-2xl font-extrabold text-white">Add New Device</Text>
                    </View>

                    {/* Instructions */}
                    <Text className="text-slate-300 text-base mb-8 leading-6">
                        Pair your EnerQoT Smart Sensor to start monitoring your system's health.
                    </Text>

                    {/* Scan QR Option */}
                    <TouchableOpacity className="bg-blue-600 rounded-3xl p-8 mb-6 items-center border border-blue-400/30">
                        <View className="bg-white/20 p-6 rounded-full mb-4">
                            <FontAwesome name="qrcode" size={48} color="white" />
                        </View>
                        <Text className="text-white font-bold text-xl mb-2">Scan QR Code</Text>
                        <Text className="text-blue-100 text-center text-sm">
                            Scan the code on the back of your device
                        </Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center mb-6">
                        <View className="flex-1 h-[1px] bg-slate-700" />
                        <Text className="text-slate-500 mx-4 font-bold">OR</Text>
                        <View className="flex-1 h-[1px] bg-slate-700" />
                    </View>

                    {/* Add Manually Option */}
                    <TouchableOpacity className="bg-slate-800/80 rounded-3xl p-6 flex-row items-center border border-white/10">
                        <View className="bg-slate-700/50 p-4 rounded-2xl mr-4">
                            <FontAwesome name="keyboard-o" size={24} color="#94a3b8" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">Enter Manually</Text>
                            <Text className="text-slate-400 text-xs mt-1">
                                Type in the Device ID and Secret Key
                            </Text>
                        </View>
                        <FontAwesome name="chevron-right" size={16} color="#475569" />
                    </TouchableOpacity>

                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}
