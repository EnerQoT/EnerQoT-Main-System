import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

export default function About() {
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

                    {/* App Logo */}
                    <View className="items-center mb-8">
                        <View className="bg-blue-600 w-24 h-24 rounded-3xl justify-center items-center mb-4">
                            <FontAwesome name="bolt" size={48} color="white" />
                        </View>
                        <Text className="text-3xl font-black text-white">EnerQoT</Text>
                        <Text className="text-slate-300 font-semibold text-sm mt-1">Smart Grid Monitor</Text>
                        <Text className="text-slate-400 text-xs mt-2">Version 1.0.0</Text>
                    </View>

                    {/* Description */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                        <Text className="text-white font-bold text-lg mb-3">About EnerQoT</Text>
                        <Text className="text-slate-300 text-sm leading-6">
                            EnerQoT is an advanced smart grid monitoring system powered by AI and machine learning.
                            It provides real-time anomaly detection, predictive analytics, and intelligent energy management
                            to ensure optimal power quality and system reliability.
                        </Text>
                    </View>

                    {/* Features */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                        <Text className="text-white font-bold text-lg mb-4">Key Features</Text>
                        <FeatureItem icon="shield" text="Hybrid Anomaly Detection (LSTM + Isolation Forest)" />
                        <FeatureItem icon="brain" text="Reinforcement Learning Smart Agent" />
                        <FeatureItem icon="line-chart" text="Real-time Power Quality Monitoring" />
                        <FeatureItem icon="bell" text="Intelligent Alert System" />
                        <FeatureItem icon="refresh" text="Adaptive Learning from Feedback" />
                        <FeatureItem icon="mobile" text="Cross-platform Mobile & Web Support" />
                    </View>

                    {/* Tech Stack */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-6">
                        <Text className="text-white font-bold text-lg mb-4">Technology Stack</Text>
                        <TechItem label="Frontend" value="React Native + Expo" />
                        <TechItem label="Backend" value="Flask + Python" />
                        <TechItem label="ML Framework" value="TensorFlow + Scikit-learn" />
                        <TechItem label="Styling" value="NativeWind + Tailwind CSS" />
                    </View>

                    {/* Legal */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 border border-white/10 mb-20">
                        <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-slate-700/50">
                            <Text className="text-white font-medium">Terms of Service</Text>
                            <FontAwesome name="chevron-right" size={16} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-slate-700/50">
                            <Text className="text-white font-medium">Privacy Policy</Text>
                            <FontAwesome name="chevron-right" size={16} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-row items-center justify-between py-3">
                            <Text className="text-white font-medium">Open Source Licenses</Text>
                            <FontAwesome name="chevron-right" size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Copyright */}
                    <Text className="text-slate-500 text-xs text-center mb-8">
                        © 2026 EnerQoT Systems. All rights reserved.
                    </Text>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

const FeatureItem = ({ icon, text }: any) => (
    <View className="flex-row items-center py-2">
        <View className="bg-blue-500/20 w-8 h-8 rounded-lg justify-center items-center mr-3">
            <FontAwesome name={icon} size={14} color="#3b82f6" />
        </View>
        <Text className="text-slate-300 text-sm flex-1">{text}</Text>
    </View>
);

const TechItem = ({ label, value }: any) => (
    <View className="flex-row justify-between items-center py-3 border-b border-slate-700/50">
        <Text className="text-slate-400 text-sm">{label}</Text>
        <Text className="text-white font-semibold text-sm">{value}</Text>
    </View>
);
