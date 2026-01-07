import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function Profile() {
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

                    {/* Profile Picture */}
                    <View className="items-center mb-8">
                        <View className="bg-blue-600 w-24 h-24 rounded-full justify-center items-center mb-3">
                            <FontAwesome name="user" size={40} color="white" />
                        </View>
                        <TouchableOpacity>
                            <Text className="text-blue-400 font-semibold">Change Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Fields */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                        <InputField label="Full Name" value="John Doe" icon="user" />
                        <InputField label="Email" value="john.doe@example.com" icon="envelope" />
                        <InputField label="Phone" value="+1 234 567 8900" icon="phone" />
                        <InputField label="Organization" value="EnerQoT Systems" icon="building" />
                    </View>

                    {/* Account Info */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-20">
                        <Text className="text-white font-bold text-lg mb-4">Account Information</Text>
                        <InfoRow label="User ID" value="EQ-2024-001" />
                        <InfoRow label="Account Type" value="Administrator" />
                        <InfoRow label="Member Since" value="January 2026" />
                        <InfoRow label="Last Login" value="Today, 5:30 PM" />
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const InputField = ({ label, value, icon }: any) => (
    <View className="mb-4">
        <Text className="text-slate-400 text-xs font-bold uppercase mb-2">{label}</Text>
        <View className="flex-row items-center bg-slate-700/50 rounded-xl p-3">
            <FontAwesome name={icon} size={16} color="#94a3b8" />
            <TextInput
                className="flex-1 text-white ml-3 font-medium"
                value={value}
                placeholderTextColor="#64748b"
            />
        </View>
    </View>
);

const InfoRow = ({ label, value }: any) => (
    <View className="flex-row justify-between items-center py-3 border-b border-slate-700/50">
        <Text className="text-slate-400 text-sm">{label}</Text>
        <Text className="text-white font-semibold text-sm">{value}</Text>
    </View>
);
