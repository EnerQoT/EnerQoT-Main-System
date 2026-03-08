import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, ImageBackground,
    RefreshControl, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getNotifications, sendNotificationFeedback } from '../../services/api';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Severity = 'NORMAL' | 'WARNING' | 'CRITICAL';
// Menu / feedback panel state for each card
// 'closed'      → no menu open
// 'menu'        → 3-dot dropdown showing (Confirm / False Alarm / Cancel)
// 'picking'     → severity correction picker showing
// 'submitting'  → API call in flight
// 'done'        → resolved chip shown
type MenuStep = 'closed' | 'menu' | 'picking' | 'submitting' | 'done_confirm' | 'done_alarm';

interface NotificationItem {
    _id: string;
    id?: string;
    device_id?: string;
    severity: Severity;
    title: string;
    message: string;
    action?: string;
    time?: string;
    read?: boolean;
    feedback_type?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Severity option configs
// ─────────────────────────────────────────────────────────────
const SEV: Record<Severity, { color: string; bg: string; border: string; icon: string; label: string; hint: string }> = {
    NORMAL: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.40)', icon: 'check-circle', label: 'Normal', hint: 'System is healthy, no anomaly' },
    WARNING: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.40)', icon: 'exclamation-triangle', label: 'Warning', hint: 'Minor anomaly, needs attention' },
    CRITICAL: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.40)', icon: 'warning', label: 'Critical', hint: 'Severe anomaly, act immediately' },
};

const CARD: Record<Severity, { bg: string; border: string; leftBorder: string; iconColor: string; badge: string }> = {
    CRITICAL: { bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.25)', leftBorder: '#dc2626', iconColor: '#f87171', badge: '#dc2626' },
    WARNING: { bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.25)', leftBorder: '#d97706', iconColor: '#fbbf24', badge: '#d97706' },
    NORMAL: { bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.25)', leftBorder: '#2563eb', iconColor: '#60a5fa', badge: '#2563eb' },
};
const CARD_ICON: Record<Severity, string> = { CRITICAL: 'warning', WARNING: 'exclamation-triangle', NORMAL: 'check-circle' };

// ─────────────────────────────────────────────────────────────
// Feedback Panel (opens below the card on 3-dot tap)
// ─────────────────────────────────────────────────────────────
interface FeedbackPanelProps {
    notif: NotificationItem;
    step: MenuStep;
    onConfirm: () => void;
    onFalseAlarmPress: () => void;
    onSeveritySelect: (sev: Severity) => void;
    onClose: () => void;
}

const FeedbackPanel = ({ notif, step, onConfirm, onFalseAlarmPress, onSeveritySelect, onClose }: FeedbackPanelProps) => {
    const options = (['NORMAL', 'WARNING', 'CRITICAL'] as Severity[]).filter(s => s !== notif.severity);

    // ── Done states ──
    if (step === 'done_confirm') {
        return (
            <View style={panelStyle}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(74,222,128,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                        <FontAwesome name="check" size={12} color="#4ade80" />
                    </View>
                    <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '600', flex: 1 }}>AI Brain updated — detection confirmed</Text>
                </View>
            </View>
        );
    }
    if (step === 'done_alarm') {
        return (
            <View style={panelStyle}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(251,191,36,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                        <FontAwesome name="graduation-cap" size={11} color="#fbbf24" />
                    </View>
                    <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '600', flex: 1 }}>AI Brain corrected — severity feedback sent</Text>
                </View>
            </View>
        );
    }

    // ── Submitting ──
    if (step === 'submitting') {
        return (
            <View style={[panelStyle, { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color="#818cf8" />
                <Text style={{ color: '#818cf8', fontSize: 12, marginLeft: 8 }}>Updating AI Brain...</Text>
            </View>
        );
    }

    // ── Severity picker ──
    if (step === 'picking') {
        return (
            <View style={panelStyle}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <FontAwesome name="times-circle" size={13} color="#f87171" />
                        <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>What should it actually be?</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>Cancel</Text>
                    </TouchableOpacity>
                </View>

                {/* Current (wrong) */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <FontAwesome name="times" size={9} color="#f87171" />
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginLeft: 6 }}>
                        Model said: <Text style={{ color: '#f87171', fontWeight: '700' }}>{notif.severity}</Text> — Select the correct severity:
                    </Text>
                </View>

                {/* Options */}
                {options.map(sev => {
                    const cfg = SEV[sev];
                    return (
                        <TouchableOpacity
                            key={sev}
                            onPress={() => onSeveritySelect(sev)}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: cfg.bg, borderRadius: 14,
                                borderWidth: 1, borderColor: cfg.border,
                                paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8
                            }}
                        >
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: cfg.bg, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                <FontAwesome name={cfg.icon as any} size={16} color={cfg.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 13 }}>{cfg.label}</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 1 }}>{cfg.hint}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={10} color={cfg.color} />
                        </TouchableOpacity>
                    );
                })}

                {/* Tip */}
                <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
                    <FontAwesome name="lightbulb-o" size={11} color="#818cf8" />
                    <Text style={{ color: '#a5b4fc', fontSize: 10, marginLeft: 6, flex: 1, lineHeight: 14 }}>
                        Bigger mismatch = stronger training signal (up to ±20 reward)
                    </Text>
                </View>
            </View>
        );
    }

    // ── Default Menu (Confirm / False Alarm / Close) ──
    return (
        <View style={panelStyle}>
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                Send Feedback — Teach the AI Brain
            </Text>

            {/* Confirm */}
            <TouchableOpacity
                onPress={onConfirm}
                style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 14,
                    borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)',
                    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8
                }}
            >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(74,222,128,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <FontAwesome name="check-circle" size={15} color="#4ade80" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#4ade80', fontWeight: '700', fontSize: 13 }}>Confirm Detection</Text>
                    <Text style={{ color: '#64748b', fontSize: 10, marginTop: 1 }}>Model was correct — this IS {notif.severity.toLowerCase()}</Text>
                </View>
                <FontAwesome name="chevron-right" size={10} color="#4ade80" />
            </TouchableOpacity>

            {/* False Alarm */}
            <TouchableOpacity
                onPress={onFalseAlarmPress}
                style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(251,113,133,0.10)', borderRadius: 14,
                    borderWidth: 1, borderColor: 'rgba(251,113,133,0.35)',
                    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8
                }}
            >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(251,113,133,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <FontAwesome name="times-circle" size={15} color="#fb7185" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fb7185', fontWeight: '700', fontSize: 13 }}>False Alarm</Text>
                    <Text style={{ color: '#64748b', fontSize: 10, marginTop: 1 }}>Model was wrong — select what it should be</Text>
                </View>
                <FontAwesome name="chevron-right" size={10} color="#fb7185" />
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
                onPress={onClose}
                style={{ alignItems: 'center', paddingVertical: 6 }}
            >
                <Text style={{ color: '#64748b', fontSize: 12 }}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );
};

const panelStyle: any = {
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginTop: 8,
};

// ─────────────────────────────────────────────────────────────
// Notification Card
// ─────────────────────────────────────────────────────────────
interface CardProps {
    notif: NotificationItem;
    onConfirm: () => Promise<void>;
    onFalseAlarm: (sev: Severity) => Promise<void>;
}

const NotificationCard = ({ notif, onConfirm, onFalseAlarm }: CardProps) => {
    const [menuStep, setMenuStep] = useState<MenuStep>(() => {
        if (notif.feedback_type === 'confirm') return 'done_confirm';
        if (notif.feedback_type === 'false_alarm') return 'done_alarm';
        return 'closed';
    });

    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }, []);

    const sev: Severity = notif.severity ?? 'NORMAL';
    const cfg = CARD[sev] ?? CARD.NORMAL;
    const icon = CARD_ICON[sev] ?? 'info-circle';
    const canFeedback = sev === 'WARNING' || sev === 'CRITICAL';

    const handleConfirm = async () => {
        setMenuStep('submitting');
        await onConfirm();
        setMenuStep('done_confirm');
    };

    const handleSeveritySelect = async (correctSev: Severity) => {
        setMenuStep('submitting');
        await onFalseAlarm(correctSev);
        setMenuStep('done_alarm');
    };

    return (
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 10 }}>
            {/* ── Main card ── */}
            <View style={{
                backgroundColor: cfg.bg, borderRadius: 18,
                borderWidth: 1, borderLeftWidth: notif.read ? 1 : 4,
                borderColor: cfg.border, borderLeftColor: cfg.leftBorder,
                padding: 14,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    {/* Icon */}
                    <View style={{ marginRight: 10, marginTop: 2 }}>
                        <FontAwesome name={icon as any} size={19} color={cfg.iconColor} />
                    </View>
                    {/* Content */}
                    <View style={{ flex: 1 }}>
                        {/* Title row */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 13, flex: 1, paddingRight: 8 }} numberOfLines={2}>
                                {notif.title}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {/* Unread dot */}
                                {!notif.read && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#3b82f6' }} />}
                                {/* 3-dot menu (only for WARNING/CRITICAL) */}
                                {canFeedback && menuStep === 'closed' && (
                                    <TouchableOpacity
                                        onPress={() => setMenuStep('menu')}
                                        style={{ paddingLeft: 6, paddingVertical: 2 }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <FontAwesome name="ellipsis-v" size={15} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                                {/* X to close open menu */}
                                {canFeedback && (menuStep === 'menu' || menuStep === 'picking') && (
                                    <TouchableOpacity
                                        onPress={() => setMenuStep('closed')}
                                        style={{ paddingLeft: 6, paddingVertical: 2 }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <FontAwesome name="times" size={13} color="#64748b" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Message */}
                        <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
                            {notif.message}
                        </Text>

                        {/* Action taken (if any) */}
                        {notif.action && notif.action !== 'None' && (
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                                <FontAwesome name="cog" size={10} color="#64748b" />
                                <Text style={{ color: '#94a3b8', fontSize: 11, marginLeft: 6, flex: 1 }} numberOfLines={2}>
                                    Action: {notif.action}
                                </Text>
                            </View>
                        )}

                        {/* Footer: time + badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <FontAwesome name="clock-o" size={10} color="#475569" />
                                <Text style={{ color: '#475569', fontSize: 11, marginLeft: 5 }}>{notif.time}</Text>
                            </View>
                            <View style={{ backgroundColor: cfg.badge, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>{sev}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* ── Feedback panel (expands below card) ── */}
            {(menuStep !== 'closed') && (
                <FeedbackPanel
                    notif={notif}
                    step={menuStep}
                    onConfirm={handleConfirm}
                    onFalseAlarmPress={() => setMenuStep('picking')}
                    onSeveritySelect={handleSeveritySelect}
                    onClose={() => setMenuStep('closed')}
                />
            )}
        </Animated.View>
    );
};

// ─────────────────────────────────────────────────────────────
// Main Notifications Screen
// ─────────────────────────────────────────────────────────────
export default function Notifications() {
    const [filter, setFilter] = useState('All');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const filters = ['All', 'Critical', 'Warning', 'Normal'];

    const fetchData = async () => {
        try {
            const result = await getNotifications('test_device_01');
            if (result?.notifications) setNotifications(result.notifications);
        } catch (e) {
            console.error('Notification fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 15000);
        return () => clearInterval(t);
    }, []);

    const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, []);

    const handleConfirm = async (notif: NotificationItem) => {
        await sendNotificationFeedback(notif._id, notif.device_id ?? 'test_device_01', 'confirm');
    };

    const handleFalseAlarm = async (notif: NotificationItem, correctSeverity: Severity) => {
        await sendNotificationFeedback(notif._id, notif.device_id ?? 'test_device_01', 'false_alarm', correctSeverity);
    };

    const filtered = notifications.filter(n => {
        if (filter === 'All') return true;
        return n.severity === filter.toUpperCase();
    });

    const unread = filtered.filter(n => !n.read).length;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop' }}
                style={{ flex: 1 }}
                imageStyle={{ opacity: 0.10 }}
                resizeMode="cover"
            >
                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                    contentContainerStyle={{ padding: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, marginTop: 4 }}>
                        <View>
                            <Text style={{ color: '#f1f5f9', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Notifications</Text>
                            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                {unread} unread alert{unread !== 1 ? 's' : ''}
                            </Text>
                        </View>
                        <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                            <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '600' }}>Clear All</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Filter chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }} contentContainerStyle={{ paddingRight: 16 }}>
                        {filters.map(f => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setFilter(f)}
                                style={{
                                    marginRight: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
                                    backgroundColor: filter === f ? '#2563eb' : 'rgba(255,255,255,0.06)',
                                    borderWidth: 1, borderColor: filter === f ? '#2563eb' : 'rgba(255,255,255,0.10)'
                                }}
                            >
                                <Text style={{ color: filter === f ? '#fff' : '#64748b', fontWeight: '700', fontSize: 12 }}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Info banner */}
                    <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', borderRadius: 16, padding: 12, marginBottom: 18, flexDirection: 'row', alignItems: 'center' }}>
                        <FontAwesome name="graduation-cap" size={14} color="#a5b4fc" />
                        <Text style={{ color: '#a5b4fc', fontSize: 11, marginLeft: 10, flex: 1, lineHeight: 16 }}>
                            Tap the <Text style={{ fontWeight: '800' }}>⋮ menu</Text> on WARNING/CRITICAL alerts to send feedback and teach the AI Brain.
                        </Text>
                    </View>

                    {/* List */}
                    <View style={{ marginBottom: 80 }}>
                        {loading && !refreshing ? (
                            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#3b82f6" />
                                <Text style={{ color: '#64748b', marginTop: 12, fontSize: 13 }}>Loading alerts...</Text>
                            </View>
                        ) : filtered.length === 0 ? (
                            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                                    <FontAwesome name="bell-slash-o" size={24} color="#334155" />
                                </View>
                                <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 15 }}>No Notifications</Text>
                                <Text style={{ color: '#475569', fontSize: 12, marginTop: 4, textAlign: 'center' }}>No alerts match this filter</Text>
                            </View>
                        ) : (
                            filtered.map((notif, i) => (
                                <NotificationCard
                                    key={notif._id || notif.id || i}
                                    notif={notif}
                                    onConfirm={() => handleConfirm(notif)}
                                    onFalseAlarm={(sev) => handleFalseAlarm(notif, sev)}
                                />
                            ))
                        )}
                    </View>
                </ScrollView>
            </ImageBackground>
        </SafeAreaView>
    );
}
