import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, RefreshControl,
    Dimensions, ImageBackground, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { getLatestStatus, sendFeedback } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import TimeRangeSelector from '../components/TimeRangeSelector';
import { usePower } from '../contexts/PowerContext';

const screenWidth = Dimensions.get("window").width;

type Severity = 'NORMAL' | 'WARNING' | 'CRITICAL';
type FeedbackStep = 'idle' | 'picking' | 'submitting' | 'done_confirm' | 'done_alarm';

// ---------------------------------------------------------------
// Severity configs (shared between picker options + card colours)
// ---------------------------------------------------------------
const SEV_OPT: Record<Severity, { color: string; bgLight: string; border: string; icon: string; label: string; hint: string }> = {
    NORMAL: { color: '#4ade80', bgLight: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.40)', icon: 'check-circle', label: 'Normal', hint: 'System is healthy, no anomaly' },
    WARNING: { color: '#fbbf24', bgLight: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.40)', icon: 'exclamation-triangle', label: 'Warning', hint: 'Minor anomaly, needs attention' },
    CRITICAL: { color: '#f87171', bgLight: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.40)', icon: 'warning', label: 'Critical', hint: 'Severe anomaly, act immediately' },
};

// ---------------------------------------------------------------
// Inline Feedback Section
// ---------------------------------------------------------------
interface FeedbackSectionProps {
    severity: Severity;
    step: FeedbackStep;
    onConfirm: () => void;
    onFalseAlarmPress: () => void;
    onSeveritySelect: (sev: Severity) => void;
    onCancelPicker: () => void;
}

const FeedbackSection = ({
    severity, step,
    onConfirm, onFalseAlarmPress, onSeveritySelect, onCancelPicker
}: FeedbackSectionProps) => {
    const options = (['NORMAL', 'WARNING', 'CRITICAL'] as Severity[]).filter(s => s !== severity);

    if (step === 'done_confirm') {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                    <FontAwesome name="check" size={11} color="#4ade80" />
                </View>
                <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '600', flex: 1 }}>
                    AI Brain updated — detection confirmed
                </Text>
            </View>
        );
    }

    if (step === 'done_alarm') {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(251,191,36,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                    <FontAwesome name="graduation-cap" size={11} color="#fbbf24" />
                </View>
                <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '600', flex: 1 }}>
                    AI Brain corrected — severity feedback sent
                </Text>
            </View>
        );
    }

    if (step === 'submitting') {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }}>
                <ActivityIndicator size="small" color="#818cf8" />
                <Text style={{ color: '#818cf8', fontSize: 12, marginLeft: 8 }}>Updating AI Brain...</Text>
            </View>
        );
    }

    if (step === 'picking') {
        return (
            <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }}>
                {/* Header row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <FontAwesome name="times-circle" size={13} color="#f87171" />
                        <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
                            False Alarm — What should it actually be?
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onCancelPicker} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                </View>

                {/* Current wrong label */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <FontAwesome name="times" size={10} color="#f87171" />
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginLeft: 8 }}>
                        Model said: <Text style={{ color: '#f87171', fontWeight: '700' }}>{severity}</Text> — Select the correct severity:
                    </Text>
                </View>

                {/* Severity buttons */}
                {options.map(sev => {
                    const cfg = SEV_OPT[sev];
                    return (
                        <TouchableOpacity
                            key={sev}
                            onPress={() => onSeveritySelect(sev)}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: cfg.bgLight, borderRadius: 16,
                                borderWidth: 1, borderColor: cfg.border,
                                paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8
                            }}
                        >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cfg.bgLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                <FontAwesome name={cfg.icon as any} size={17} color={cfg.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 14 }}>{cfg.label}</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>{cfg.hint}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={11} color={cfg.color} />
                        </TouchableOpacity>
                    );
                })}

                {/* Training info note */}
                <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
                    <FontAwesome name="lightbulb-o" size={12} color="#818cf8" />
                    <Text style={{ color: '#a5b4fc', fontSize: 10, marginLeft: 8, flex: 1, lineHeight: 14 }}>
                        Bigger mismatch = stronger training signal. NORMAL vs CRITICAL gives the AI a ±20 reward for faster learning.
                    </Text>
                </View>
            </View>
        );
    }

    // Default: idle — Confirm + False Alarm buttons
    return (
        <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }}>
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                Teach the AI Brain
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                    onPress={onConfirm}
                    style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        paddingVertical: 10, borderRadius: 14,
                        backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)'
                    }}
                >
                    <FontAwesome name="check-circle" size={13} color="#4ade80" />
                    <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>Confirm</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onFalseAlarmPress}
                    style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        paddingVertical: 10, borderRadius: 14,
                        backgroundColor: 'rgba(251,113,133,0.12)', borderWidth: 1, borderColor: 'rgba(251,113,133,0.4)'
                    }}
                >
                    <FontAwesome name="times-circle" size={13} color="#fb7185" />
                    <Text style={{ color: '#fb7185', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>False Alarm</Text>
                    <FontAwesome name="chevron-up" size={9} color="#fb7185" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ---------------------------------------------------------------
// Main Monitor Screen
// ---------------------------------------------------------------
export default function Monitor() {
    const [data, setData] = useState<any>(null);
    const [history, setHistory] = useState<number[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState('20s');
    const [feedbackStep, setFeedbackStep] = useState<FeedbackStep>('idle');
    const [deviceOffline, setDeviceOffline] = useState(false);
    const { isPowerOn, setIsPowerOn, lastKnownTimestamp, setLastKnownTimestamp } = usePower();

    const isPowerOnRef = useRef(isPowerOn);
    const localLastProcessedTimestampRef = useRef<string | null>(null);
    const lastDataReceivedAtRef = useRef<number>(Date.now()); // wall-clock ms of last new data

    useEffect(() => { isPowerOnRef.current = isPowerOn; }, [isPowerOn]);

    // Reset feedback when severity changes (new anomaly detected)
    const prevSeverityRef = useRef<string | null>(null);
    useEffect(() => {
        const sev = data?.severity;
        if (sev && sev !== prevSeverityRef.current) {
            prevSeverityRef.current = sev;
            setFeedbackStep('idle');   // Fresh anomaly → reset buttons
        }
    }, [data?.severity]);

    const getTimeRangeConfig = (range: string) => {
        const configs: any = {
            '20s': { maxPoints: 20, interval: 2000 },
            '1m': { maxPoints: 60, interval: 2000 },
            '5m': { maxPoints: 60, interval: 5000 },
            '15m': { maxPoints: 60, interval: 15000 },
            '1h': { maxPoints: 60, interval: 60000 },
            '5h': { maxPoints: 60, interval: 300000 },
            '1d': { maxPoints: 48, interval: 1800000 },
            'week': { maxPoints: 56, interval: 10800000 },
            'month': { maxPoints: 60, interval: 43200000 },
            'year': { maxPoints: 52, interval: 604800000 },
        };
        return configs[range] || configs['20s'];
    };

    const config = getTimeRangeConfig(timeRange);

    const fetchData = async () => {
        try {
            const result = await getLatestStatus('test_device_01');
            if (result && result.data) {
                if (localLastProcessedTimestampRef.current && result.timestamp === localLastProcessedTimestampRef.current) return;
                if (!isPowerOnRef.current) setIsPowerOn(true);
                setLastKnownTimestamp(result.timestamp);
                localLastProcessedTimestampRef.current = result.timestamp;
                setData(result);

                // New data received — reset offline flag
                lastDataReceivedAtRef.current = Date.now();
                setDeviceOffline(false);

                const power = result.data.voltage * result.data.current * result.data.power_factor;
                setHistory(prev => {
                    const n = [...prev, power];
                    if (n.length > config.maxPoints) n.shift();
                    return n;
                });
            }
        } catch (e) {
            console.log("Error fetching data", e);
        }
    };

    // 30-second inactivity watchdog
    useEffect(() => {
        const watchdog = setInterval(() => {
            if (Date.now() - lastDataReceivedAtRef.current > 30000 && isPowerOnRef.current) {
                setDeviceOffline(true);
            }
        }, 5000);
        return () => clearInterval(watchdog);
    }, []);

    useEffect(() => {
        if (!isPowerOn) {
            setData(null);
            setHistory([]);
            setDeviceOffline(false);
            lastDataReceivedAtRef.current = Date.now();
        }
        const interval = setInterval(fetchData, config.interval);
        fetchData();
        return () => clearInterval(interval);
    }, [timeRange, isPowerOn]);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchData().then(() => setRefreshing(false));
    }, []);

    // ── Feedback handlers ──────────────────────────────────────
    const handleConfirm = async () => {
        setFeedbackStep('submitting');
        try {
            await sendFeedback(data?.device_id || 'test_device_01', 1, 'confirm');
        } catch (e) { console.error(e); }
        setFeedbackStep('done_confirm');
    };

    const handleSeveritySelect = async (correctSev: Severity) => {
        setFeedbackStep('submitting');
        try {
            const correct_label = correctSev === 'NORMAL' ? 0 : 1;
            await sendFeedback(
                data?.device_id || 'test_device_01',
                correct_label,
                'false_alarm',
                correctSev
            );
        } catch (e) { console.error(e); }
        setFeedbackStep('done_alarm');
    };
    // ───────────────────────────────────────────────────────────

    const severity: Severity = (data?.severity as Severity) || 'NORMAL';
    const isCritical = severity === 'CRITICAL';
    const isWarning = severity === 'WARNING';
    const showFeedback = isCritical || isWarning;

    let statusBg = '#2563eb';
    let statusText = 'System is Stable';
    let statusIcon = 'check-circle';
    if (isCritical) { statusBg = '#dc2626'; statusText = 'Critical Anomaly Detected'; statusIcon = 'warning'; }
    else if (isWarning) { statusBg = '#d97706'; statusText = 'Warning: Check parameters'; statusIcon = 'exclamation-triangle'; }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                style={{ flex: 1 }}
                imageStyle={{ opacity: 0.15 }}
                resizeMode="cover"
            >
                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                    contentContainerStyle={{ padding: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── OFFLINE card if no data for 30s or device off ── */}
                    {(!isPowerOn || deviceOffline) && (
                        <View style={{
                            borderRadius: 20, padding: 18, marginBottom: 18,
                            backgroundColor: 'rgba(51,65,85,0.7)',
                            borderWidth: 1, borderLeftWidth: 4,
                            borderColor: 'rgba(100,116,139,0.4)', borderLeftColor: '#64748b'
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <FontAwesome name="power-off" size={18} color="#64748b" />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Current Status</Text>
                                    <Text style={{ color: '#e2e8f0', fontSize: 22, fontWeight: '900' }}>
                                        {deviceOffline && isPowerOn ? 'OFFLINE' : 'OFF'}
                                    </Text>
                                </View>
                            </View>
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center' }}>
                                <FontAwesome name="info-circle" size={13} color="#64748b" />
                                <Text style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>
                                    {deviceOffline && isPowerOn
                                        ? 'No data received for 30s — device may be off or disconnected'
                                        : 'Turn on device to start monitoring'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* ── CURRENT STATUS CARD (with feedback) ── */}
                    {data && !deviceOffline && isPowerOn && (

                        <View
                            style={{
                                borderRadius: 20,
                                padding: 16,
                                marginBottom: 18,
                                backgroundColor: `${statusBg}22`,
                                borderWidth: 1,
                                borderColor: `${statusBg}55`,
                                borderLeftWidth: 4,
                                borderLeftColor: statusBg
                            }}
                        >
                            {/* Status header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <FontAwesome name={statusIcon as any} size={18} color={statusBg} />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Current Status
                                    </Text>
                                    <Text style={{ color: statusBg, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 }}>
                                        {severity}
                                    </Text>
                                </View>
                                {/* Scoring mode badge */}
                                {data?.scoring_mode && (
                                    <View style={{ backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                                        <Text style={{ color: '#a5b4fc', fontSize: 9, fontWeight: '700' }}>
                                            {data.scoring_mode === 'hybrid' ? '🤖 Hybrid AI' : 'iForest'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={{ color: '#cbd5e1', fontSize: 13, marginBottom: showFeedback ? 12 : 0 }}>
                                {statusText}
                                {data?.anomaly_score != null && (
                                    <Text style={{ color: '#64748b', fontSize: 11 }}>  · Score: {(data.anomaly_score * 100).toFixed(0)}%</Text>
                                )}
                            </Text>

                            {/* ── Inline Feedback Section ── */}
                            {showFeedback && (
                                <FeedbackSection
                                    severity={severity}
                                    step={feedbackStep}
                                    onConfirm={handleConfirm}
                                    onFalseAlarmPress={() => setFeedbackStep('picking')}
                                    onSeveritySelect={handleSeveritySelect}
                                    onCancelPicker={() => setFeedbackStep('idle')}
                                />
                            )}
                        </View>
                    )}

                    {/* ── Live Metrics Grid ── */}
                    <Text className="text-white font-bold text-lg mb-4 ml-1">Live Metrics</Text>
                    <View className="flex-row flex-wrap justify-between mb-2">
                        <SensorCard label="Voltage" value={isPowerOn ? data?.data?.voltage : undefined} unit="V" icon="flash" color="text-yellow-400" bgColor="bg-yellow-400/10" />
                        <SensorCard label="Current" value={isPowerOn ? data?.data?.current : undefined} unit="A" icon="bolt" color="text-cyan-400" bgColor="bg-cyan-400/10" />
                        <SensorCard label="Frequency" value={isPowerOn ? data?.data?.frequency : undefined} unit="Hz" icon="dashboard" color="text-purple-400" bgColor="bg-purple-400/10" />
                        <SensorCard label="Temp" value={isPowerOn ? data?.data?.temperature : undefined} unit="°C" icon="thermometer" color="text-rose-400" bgColor="bg-rose-400/10" />
                    </View>

                    {/* ── Time Range Selector ── */}
                    <View className="mb-6">
                        <Text className="text-white font-bold text-lg mb-3 ml-1">Time Range</Text>
                        <TimeRangeSelector selected={timeRange} onSelect={setTimeRange} />
                    </View>

                    {/* ── Power Chart ── */}
                    <View className="bg-slate-800/80 rounded-3xl p-5 shadow-lg mb-8 border border-white/10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-white">Power Consumption</Text>
                            <Text className="text-slate-400 text-xs font-bold uppercase">
                                {timeRange === '20s' ? 'Last 20s' : timeRange === '1m' ? 'Last 1 min' :
                                    timeRange === '5m' ? 'Last 5 min' : timeRange === '15m' ? 'Last 15 min' :
                                        timeRange === '1h' ? 'Last 1 hour' : timeRange === '5h' ? 'Last 5 hours' :
                                            timeRange === '1d' ? 'Last 24 hours' : timeRange === 'week' ? 'Last Week' :
                                                timeRange === 'month' ? 'Last Month' : 'Last Year'}
                            </Text>
                        </View>

                        {history.length > 0 ? (
                            <LineChart
                                data={{ labels: [], datasets: [{ data: history }] }}
                                width={screenWidth - 80}
                                height={220}
                                withDots={false}
                                withInnerLines={true}
                                withOuterLines={false}
                                withVerticalLines={false}
                                yAxisInterval={1}
                                chartConfig={{
                                    backgroundColor: "transparent",
                                    backgroundGradientFrom: "#1e293b",
                                    backgroundGradientTo: "#1e293b",
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(56, 189, 248, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                                    propsForBackgroundLines: { strokeDasharray: "4", stroke: "#334155" },
                                    fillShadowGradientFrom: "#38bdf8",
                                    fillShadowGradientTo: "#1e293b",
                                    fillShadowGradientOpacity: 0.3,
                                }}
                                bezier
                                style={{ borderRadius: 16 }}
                            />
                        ) : (
                            <View className="h-48 justify-center items-center bg-white/5 rounded-2xl">
                                <Text className="text-slate-400 font-medium">Waiting for sensors...</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------
// SensorCard (unchanged)
// ---------------------------------------------------------------
const SensorCard = ({ label, value, unit, icon, color, bgColor }: any) => (
    <View className="bg-slate-800/80 w-[48%] p-5 rounded-3xl mb-4 shadow-lg border border-white/5 backdrop-blur-sm">
        <View className={`w-10 h-10 ${bgColor} rounded-full justify-center items-center mb-3`}>
            <FontAwesome
                name={icon}
                size={18}
                color={color === 'text-yellow-400' ? '#facc15' : color === 'text-cyan-400' ? '#22d3ee' : color === 'text-purple-400' ? '#a78bfa' : '#fb7185'}
            />
        </View>
        <Text className="text-3xl font-black text-white tracking-tight">
            {value !== undefined ? value : "--"}
            <Text className="text-sm text-slate-400 ml-1 font-bold">{unit}</Text>
        </Text>
        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{label}</Text>
    </View>
);
