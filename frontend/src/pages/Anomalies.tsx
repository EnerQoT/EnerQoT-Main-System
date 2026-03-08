import React, { useEffect, useState } from 'react';
import { getAllDevices, getDeviceAnomalies, type AnomalyLog } from '../services/api';
import { AlertCircle, Zap, Activity, Thermometer, Info } from 'lucide-react';

export default function Anomalies() {
    const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const devices = await getAllDevices();
            const allAnomalies: AnomalyLog[] = [];

            for (const device of devices) {
                const deviceAnomalies = await getDeviceAnomalies(device.device_id);
                allAnomalies.push(...deviceAnomalies);
            }

            // Sort by timestamp descending
            allAnomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setAnomalies(allAnomalies);
        } catch (error) {
            console.error("Error fetching anomalies:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
            case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default: return 'bg-green-100 text-green-800 border-green-200';
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">System Anomalies</h1>

            {loading && anomalies.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Loading anomalies...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Time</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Device</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Severity</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Score</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Action Taken</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {anomalies.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No anomalies recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    anomalies.map((log) => (
                                        <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {log.device_id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(log.severity)}`}>
                                                    {log.severity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {(log.anomaly_score * 100).toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {log.action_taken}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
