import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PowerContextType {
    isPowerOn: boolean;
    togglePower: () => void;
}

const PowerContext = createContext<PowerContextType | undefined>(undefined);

export function PowerProvider({ children }: { children: ReactNode }) {
    const [isPowerOn, setIsPowerOn] = useState(true);

    const togglePower = () => {
        setIsPowerOn(prev => !prev);
    };

    return (
        <PowerContext.Provider value={{ isPowerOn, togglePower }}>
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
