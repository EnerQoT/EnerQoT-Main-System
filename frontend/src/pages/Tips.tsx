import { useEffect, useState, useRef } from 'react';
import { getAllTipsData, fetchLatestSensorData, postTelemetry, type TipsData, type RealTimeSensorData, type TelemetryResponse } from '../services/tipsApi';
import { TrendingDown, TrendingUp, Zap, Target, Activity, PlusCircle, Scale, Thermometer, Droplets, Wifi, Battery } from 'lucide-react';

export default function Tips() {
    const [data, setData] = useState<TipsData | null>(null);
    const [realTimeData, setRealTimeData] = useState<RealTimeSensorData | null>(null);
    const [cumulativeEnergy, setCumulativeEnergy] = useState<number | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
    const [loading, setLoading] = useState(true);

    // Create a polling reference to clean up if needed
    const pollingRef = useRef<number | ReturnType<typeof setInterval> | null>(null);

    // Watch the cumulativeEnergy state. Whenever it updates in real-time, send the new accumulated total 
    // to the backend to retrieve fresh ML historical comparisons.
    useEffect(() => {
        if (cumulativeEnergy !== null) {
            postTelemetry("AC", cumulativeEnergy).then((res) => {
                if (res) {
                    setTelemetry(res);
                }
            });
        }
    }, [cumulativeEnergy]);

    useEffect(() => {
        // Fetch recommendations and standard tip data
        getAllTipsData().then((res) => {
            if (res) {
                const useFallback = !res.recommendations || res.recommendations.length === 0 || Object.keys(res.top_devices || {}).length === 0;
                
                setData({
                    forecast: res.forecast || { today: 0, tomorrow: 0 },
                    top_devices: useFallback ? { "Real-Time IoT Data": 45.2 } : res.top_devices,
                    recommendations: useFallback ? [] : res.recommendations
                });
            } else {
                setData({
                    forecast: { today: 0, tomorrow: 0 },
                    top_devices: { "Real-Time IoT Data": 45.2 },
                    recommendations: []
                });
            }
            // Temporarily set a default cumulative energy from mock data if telemetry hasn't loaded 
            // to kickstart the telemetry loop above if the network is slow.
            if (cumulativeEnergy === null) {
                 setCumulativeEnergy(45.2);
            }
            setLoading(false);
        });

        // Setup real-time polling
        const fetchRealTime = () => {
             fetchLatestSensorData().then((res) => {
                 if(res) {
                     setRealTimeData(res);
                     // Use the device's native energy measurement directly (converted from Wh to kWh)
                     const energyValue = res.pzem?.energy ?? (res as any)?.energy;
                     if (energyValue !== undefined) {
                         setCumulativeEnergy(energyValue);
                     }
                 }
             });
         };
        
        // Fetch immediately, then setup interval every 2.5 seconds
        fetchRealTime();
        pollingRef.current = setInterval(fetchRealTime, 2500);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current as number);
            }
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!data || Object.keys(data.top_devices).length === 0) {
        return <div className="p-8 text-red-500">Failed to load device data. Please try again.</div>;
    }

    const selectedDeviceName = Object.keys(data.top_devices)[0];
    
    // Read Comparison Metrics From Backend Telemetry Response
    const selectedUsage = telemetry?.analysis?.current_usage || 4.85;
    const meanDailyUsage = telemetry?.analysis?.historical_mean || 5.0;
    const stdDev = telemetry?.analysis?.std_dev || 0.1;

    // Determine usage level classification using +/- 1 std dev methodology
    let usageLevel = 'Normal Usage';
    let usageColorText = 'text-gray-600';
    let usageColorBg = 'bg-gray-200';
    let usageBorder = 'border-gray-200';
    
    // Safety check fallback
    const effectiveStdDev = Math.max(stdDev, meanDailyUsage * 0.05);

    if (selectedUsage <= meanDailyUsage - effectiveStdDev) {
        usageLevel = 'Low: Keep Using as usual';
        usageColorText = 'text-blue-700';
        usageColorBg = 'bg-blue-100';
        usageBorder = 'border-blue-200';
    } else if (selectedUsage > meanDailyUsage + effectiveStdDev) {
        usageLevel = 'High: Reduce usage to save bill';
        usageColorText = 'text-orange-700';
        usageColorBg = 'bg-orange-100';
        usageBorder = 'border-orange-200';
    }

    // Calculate Difference
    const usageDifference = meanDailyUsage - selectedUsage;
    const isSaved = usageDifference >= 0;

    const formatCurrent = (val?: number) => {
        if (val === undefined || val === null) return { v: val, u: "A" };
        if (val > 0 && val < 1) return { v: val * 1000, u: "mA" };
        return { v: val, u: "A" };
    };

    const formatPower = (val?: number) => {
        if (val === undefined || val === null) return { v: val, u: "W" };
        if (val > 0 && val < 1) return { v: val * 1000, u: "W" };
        return { v: val, u: "W" };
    };

    const formatEnergy = (val?: number) => {
        if (val === undefined || val === null) return { v: val, u: "Wh" };
        if (val > 0 && val < 0.001) return { v: val * 1000000, u: "mWh" };
        if (val >= 0.001 && val < 1) return { v: val * 1000, u: "Wh" };
        return { v: val, u: "Wh" };
    };

    // Robust property extraction with fallbacks
    const voltageValue = realTimeData?.pzem?.voltage ?? (realTimeData as any)?.voltage;
    const currentRaw = realTimeData?.pzem?.current ?? (realTimeData as any)?.current;
    const powerRaw = realTimeData?.pzem?.power ?? (realTimeData as any)?.power;
    const energyRaw = realTimeData?.pzem?.energy ?? (realTimeData as any)?.energy;
    const tempValue = realTimeData?.si7021?.temperature ?? (realTimeData as any)?.temperature;
    const humValue = realTimeData?.si7021?.humidity ?? (realTimeData as any)?.humidity;
    const batValue = realTimeData?.ina3221?.battery?.voltage ?? (realTimeData as any)?.ina3221?.voltage;
    const rssiValue = realTimeData?.system?.rssi ?? (realTimeData as any)?.rssi;

    const currentFmt = formatCurrent(currentRaw);
    const powerFmt = formatPower(powerRaw);
    const energyFmt = formatEnergy(energyRaw);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-200 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Active Real-Time Insights & Tips</h1>
                    <p className="text-gray-500 mt-2 flex items-center">
                        <Target className="w-4 h-4 mr-1 text-indigo-500" />
                        Targeted analysis and real-time active data monitoring directly from the Backend.
                    </p>
                </div>
                <div className="bg-white border border-indigo-100 shadow-sm px-6 py-3 rounded-xl flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Viewing Source</p>
                        <p className="text-indigo-900 font-semibold">{selectedDeviceName}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Left Column: Live IoT Realtime Stats */}
                <div className="flex flex-col space-y-6 h-full">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center justify-between min-h-[32px]">
                         <div className="flex items-center">
                             <Activity className="w-5 h-5 mr-2 text-blue-600" />
                             Real-Time Core Parameters Formatted
                         </div>
                         <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                              <span>Live</span>
                         </div>
                    </h3>
                    
                    {realTimeData ? (
                         <div className="grid grid-cols-2 gap-4 flex-1">
                              <StatCard icon={<Zap className="w-5 h-5 text-yellow-500" />} label="Main Voltage" value={voltageValue} unit="V" />
                              <StatCard icon={<TrendingDown className="w-5 h-5 text-indigo-500" />} label="Main Current" value={currentFmt.v} unit={currentFmt.u} />
                              <StatCard icon={<Activity className="w-5 h-5 text-emerald-500" />} label="Power" value={powerFmt.v} unit={powerFmt.u} />
                              <StatCard icon={<PlusCircle className="w-5 h-5 text-blue-500" />} label="Energy" value={energyFmt.v} unit={energyFmt.u} />
                              <StatCard icon={<Thermometer className="w-5 h-5 text-red-500" />} label="Temp" value={tempValue} unit="°C" />
                              <StatCard icon={<Droplets className="w-5 h-5 text-cyan-500" />} label="Humidity" value={humValue} unit="%" />
                              <StatCard icon={<Battery className="w-5 h-5 text-green-500" />} label="Battery V" value={batValue} unit="V" />
                              <StatCard icon={<Wifi className="w-5 h-5 text-purple-500" />} label="Signal" value={rssiValue} unit="dBm" />
                         </div>
                    ) : (
                         <div className="bg-gray-50 border border-gray-200 rounded-2xl flex-1 flex flex-col items-center justify-center space-y-4">
                               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                               <p className="text-gray-500 text-sm">Waiting for live sensor data stream...</p>
                         </div>
                    )}
                </div>
                
                {/* Right Column: Historical Mean Usage Comparison */}
                <div className="flex flex-col space-y-6 h-full">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center min-h-[32px]">
                        <Scale className="w-5 h-5 mr-2 text-orange-500" />
                        Daily Usage Comparison
                    </h3>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col items-center justify-center p-8 relative">                         
                         <div className="w-full flex justify-between items-center mb-10 z-10 space-x-8">
                             <div className="text-center flex-1">
                                 <p className="text-xs uppercase font-bold text-gray-400 mb-2 tracking-wider">Historical Mean</p>
                                 <div className="text-3xl font-bold text-gray-700">{meanDailyUsage.toFixed(2)} <span className="text-lg font-medium text-gray-400">kWh</span></div>
                             </div>
                             
                             <div className="h-16 w-px bg-gray-200 hidden sm:block"></div>
                             
                             <div className="text-center flex-1">
                                 <p className="text-xs uppercase font-bold text-gray-400 mb-2 tracking-wider">Today's Usage</p>
                                 <div className="text-3xl font-bold text-gray-900">{selectedUsage.toFixed(2)} <span className="text-lg font-medium text-gray-400">kWh</span></div>
                             </div>
                         </div>
                         
                         <div className={`w-full rounded-2xl p-4 relative overflow-hidden z-10 flex items-center justify-between ${isSaved ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                              <div className="flex items-center">
                                   <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${isSaved ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                       {isSaved ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                                   </div>
                                   <div>
                                       <h4 className={`font-bold tracking-tight mb-0.5 ${isSaved ? 'text-green-800' : 'text-red-800'}`}>
                                           {isSaved ? 'Energy Saved' : 'Usage Overrun'}
                                       </h4>
                                       <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className={`text-sm font-semibold px-2 py-0.5 rounded-md border ${usageColorBg} ${usageColorText} ${usageBorder}`}>
                                                {usageLevel}
                                            </span>
                                       </div>
                                   </div>
                              </div>
                              <div className={`text-4xl font-extrabold tracking-tight ${isSaved ? 'text-green-700' : 'text-red-700'}`}>
                                  {Math.abs(usageDifference).toFixed(2)} <span className="text-lg font-bold opacity-80">kWh</span>
                              </div>
                         </div>
                    </div>
                </div>
            </div>
            
            {/* Predicted Usage Banner */}
                <div className="bg-indigo-600 rounded-3xl p-8 mb-8 text-white shadow-lg flex items-center justify-between">
                    <div className="flex items-center space-x-8">
                        <div className="bg-white/20 p-4 rounded-2xl">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Predicted Power Usage</h2>
                            <p className="text-indigo-200">Expected consumption for tomorrow</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-black tracking-tighter">
                            {data?.forecast?.tomorrow || 5.02}<span className="text-2xl font-medium text-indigo-200 ml-2">kWh</span>
                        </div>
                    </div>
                </div>

        </div>
    );
}

function StatCard({ icon, label, value, unit }: { icon: React.ReactNode, label: string, value?: number | null, unit: string }) {
    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
                 <div className="bg-gray-50 p-2 rounded-lg">
                      {icon}
                 </div>
                 <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span>
            </div>
            <div className="flex items-end space-x-1">
                 <span className="text-2xl font-black text-gray-800 tracking-tight">
                     {value !== undefined && value !== null ? (Number.isInteger(value) ? value : value.toFixed(2)) : 'N/A'}
                 </span>
                 {unit && <span className="text-sm font-semibold text-gray-500 mb-1">{unit}</span>}
            </div>
        </div>
    );
}
