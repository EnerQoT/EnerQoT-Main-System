import React, { createContext, useContext, useState, ReactNode } from 'react';
import { sendDeviceCommand } from '../../services/api';

interface PowerContextType {
    isPowerOn: boolean;
    setIsPowerOn: (on: boolean) => void;
    lastKnownTimestamp: string | null;
    setLastKnownTimestamp: (timestamp: string | null) => void;
    isAutoShutdownEnabled: boolean;
    setIsAutoShutdownEnabled: (enabled: boolean) => void;
    togglePower: () => Promise<void>;
    turnOffPower: () => Promise<void>;
}

const PowerContext = createContext<PowerContextType | undefined>(undefined);

export function PowerProvider({ children }: { children: ReactNode }) {
    const [isPowerOn, setIsPowerOn] = useState(true);
    const [lastKnownTimestamp, setLastKnownTimestamp] = useState<string | null>(null);
    const [isAutoShutdownEnabled, setIsAutoShutdownEnabled] = useState(true);

    const togglePower = async () => {
        const command = isPowerOn ? "OFF" : "ON";
        // Call backend API to handle MQTT broadcast before executing local toggle
        const response = await sendDeviceCommand('test_device_01', command);
        if (response?.status === 'success') {
            setIsPowerOn((prev) => !prev);
        } else {
            console.error("Failed to toggle device power on the backend.");
        }
    };

    const turnOffPower = async () => {
        if (!isPowerOn) return;
        const response = await sendDeviceCommand('test_device_01', 'OFF');
        if (response?.status === 'success') {
            setIsPowerOn(false);
        }
    };

    return (
        <PowerContext.Provider value={{ isPowerOn, setIsPowerOn, lastKnownTimestamp, setLastKnownTimestamp, isAutoShutdownEnabled, setIsAutoShutdownEnabled, togglePower, turnOffPower }}>
            {children}
        </PowerContext.Provider>
    );
}

export function usePower() {
    const context = useContext(PowerContext);
    if (context === undefined) {
        throw new Error('usePower must be used within a PowerProvider');
    }
    return context;
}
