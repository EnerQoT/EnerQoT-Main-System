import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Animated, StyleSheet } from 'react-native';

export default function SplashScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <Image
                    source={require('../../assets/images/Logo _Ener.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>EnerQoT</Text>
                <Text style={styles.subtitle}>Smart Grid Monitor</Text>

                <View style={styles.loadingContainer}>
                    <View style={styles.loadingBar}>
                        <Animated.View
                            style={[
                                styles.loadingProgress,
                                {
                                    opacity: fadeAnim,
                                },
                            ]}
                        />
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 180,
        height: 180,
        marginBottom: 24,
    },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginBottom: 40,
        letterSpacing: 0.5,
    },
    loadingContainer: {
        width: 200,
        marginTop: 20,
    },
    loadingBar: {
        height: 4,
        backgroundColor: '#1e293b',
        borderRadius: 2,
        overflow: 'hidden',
    },
    loadingProgress: {
        height: '100%',
        width: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 2,
    },
});
