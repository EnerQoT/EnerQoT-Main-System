import React, { useEffect, useState } from 'react';
import { getAllDevices, type Device } from '../services/api';
import { Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function Devices() {
    const [devices, setDevices] = useState<Device[]>([]);

    useEffect(() => {
        const fetchDevices = () => {
            getAllDevices().then(setDevices);
        };

        fetchDevices();
        const interval = setInterval(fetchDevices, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Device ID</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Last Active</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Active Alerts</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {devices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No devices found. Send data via Postman to register a device.
                                    </td>
                                </tr>
                            ) : (
                                devices.map((device) => (
                                    <tr key={device.device_id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                    <Server className="w-5 h-5" />
                                                </div>
                                                <span className="font-medium text-gray-900">{device.device_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${device.status === 'online'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {device.status === 'online' ? (
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                )}
                                                {device.status.toUpperCase()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {device.last_active ? new Date(device.last_active).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {device.active_alerts > 0 ? (
                                                <div className="flex items-center text-red-600 font-medium">
                                                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                                                    {device.active_alerts} Critical
                                                </div>
                                            ) : (
                                                <span className="text-green-600 text-sm">No Issues</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {device.location || 'Unknown'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
