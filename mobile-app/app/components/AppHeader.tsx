import React from 'react';
import { View, Text, TouchableOpacity, ImageBackground } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function AppHeader() {
    const router = useRouter();

    return (
        <View className="bg-slate-900">
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <View className="flex-row items-center justify-between px-5 pt-10 pb-4 border-b border-white/10">
                    {/* Left Profile Icon */}
                    <TouchableOpacity
                        onPress={() => router.push('/profile')}
                        className="bg-white/10 p-2 rounded-lg backdrop-blur-md"
                    >
                        <FontAwesome name="user" size={20} color="white" />
                    </TouchableOpacity>

                    {/* Center Logo */}
                    <View className="items-center">
                        <Text className="text-2xl font-black text-white tracking-tight">
                            EnerQoT
                        </Text>
                        <Text className="text-slate-300 font-semibold uppercase tracking-widest text-[10px]">
                            Smart Grid Monitor
                        </Text>
                    </View>

                    {/* Right Menu Icon */}
                    <TouchableOpacity
                        onPress={() => router.push('/menu')}
                        className="bg-white/10 p-2 rounded-lg backdrop-blur-md"
                    >
                        <FontAwesome name="bars" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </ImageBackground>
        </View>
    );
}
