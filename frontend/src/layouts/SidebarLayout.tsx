import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, AlertTriangle, Settings, Zap } from 'lucide-react';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200">
                <div className="h-16 flex items-center px-6 border-b border-gray-200">
                    <Zap className="w-6 h-6 text-indigo-600 mr-2" />
                    <span className="text-xl font-bold text-gray-900">EnerQoT</span>
                </div>

                <nav className="p-4 space-y-1">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`
                        }
                    >
                        <LayoutDashboard className="w-5 h-5 mr-3" />
                        Dashboard
                    </NavLink>

                    <NavLink
                        to="/devices"
                        className={({ isActive }) =>
                            `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`
                        }
                    >
                        <Server className="w-5 h-5 mr-3" />
                        Devices
                    </NavLink>

                    <NavLink
                        to="/anomalies"
                        className={({ isActive }) =>
                            `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`
                        }
                    >
                        <AlertTriangle className="w-5 h-5 mr-3" />
                        Anomalies
                    </NavLink>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`
                        }
                    >
                        <Settings className="w-5 h-5 mr-3" />
                        Settings
                    </NavLink>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="bg-white h-16 border-b border-gray-200 flex items-center px-8 justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Admin Console</h2>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">Administrator</span>
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            A
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
