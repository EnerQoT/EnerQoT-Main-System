import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import AppHeader from '../components/AppHeader';
import { PowerProvider } from '../contexts/PowerContext';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: 4 }} {...props} />;
}

export default function TabLayout() {
  return (
    <PowerProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: {
            backgroundColor: '#0f172a',
            borderTopWidth: 1,
            borderTopColor: '#1e293b',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
          },
          headerShown: true,
          header: () => <AppHeader />,
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="monitor"
          options={{
            title: 'Monitor',
            tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
          }}
        />
        <Tabs.Screen
          name="tips"
          options={{
            title: 'Tips',
            tabBarIcon: ({ color }) => <TabBarIcon name="lightbulb-o" color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color }) => <TabBarIcon name="file-text-o" color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />,
          }}
        />
      </Tabs>
    </PowerProvider>
  );
}
