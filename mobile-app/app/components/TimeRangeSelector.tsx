import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface TimeRangeSelectorProps {
    selected: string;
    onSelect: (range: string) => void;
}

const timeRanges = [
    { label: '20s', value: '20s' },
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '5h', value: '5h' },
    { label: '1d', value: '1d' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
];

export default function TimeRangeSelector({ selected, onSelect }: TimeRangeSelectorProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
        >
            {timeRanges.map((range) => (
                <TouchableOpacity
                    key={range.value}
                    onPress={() => onSelect(range.value)}
                    className={`mr-2 px-4 py-2 rounded-full ${selected === range.value
                            ? 'bg-blue-600'
                            : 'bg-slate-800/80 border border-white/10'
                        }`}
                >
                    <Text
                        className={`font-bold text-sm ${selected === range.value ? 'text-white' : 'text-slate-400'
                            }`}
                    >
                        {range.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}
