import React, { useEffect, useState } from 'react';
import { getDashboardStats, type DashboardStats } from '../services/api';
import { Activity, Server, AlertOctagon, Heart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        getDashboardStats().then(setStats);
    }, []);

    // Dummy chart data
    const data = [
        { name: '00:00', anomalies: 0 },
        { name: '04:00', anomalies: 1 },
        { name: '08:00', anomalies: 3 },
        { name: '12:00', anomalies: 2 },
        { name: '16:00', anomalies: 5 },
        { name: '20:00', anomalies: 4 },
        { name: '23:59', anomalies: 2 },
    ];

    if (!stats) return <div className="p-8">Loading dashboard...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Devices"
                    value={stats.total_devices}
                    icon={<Server className="w-6 h-6 text-blue-600" />}
                    bg="bg-blue-50"
                />
                <StatCard
                    title="Active Now"
                    value={stats.active_devices}
                    icon={<Activity className="w-6 h-6 text-green-600" />}
                    bg="bg-green-50"
                />
                <StatCard
                    title="Critical Alerts (24h)"
                    value={stats.total_anomalies_24h}
                    icon={<AlertOctagon className="w-6 h-6 text-red-600" />}
                    bg="bg-red-50"
                />
                <StatCard
                    title="System Health"
                    value={`${stats.system_health}%`}
                    icon={<Heart className="w-6 h-6 text-indigo-600" />}
                    bg="bg-indigo-50"
                />
            </div>

            {/* Main Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Anomaly Detection Trend</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Area
                                type="monotone"
                                dataKey="anomalies"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorAnomalies)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, bg }: { title: string, value: string | number, icon: React.ReactNode, bg: string }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className={`p-4 rounded-lg ${bg} mr-4`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}
