import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Chat' },
        { path: '/archives', label: 'Archives' },
        { path: '/p2p', label: 'P2P Network' },
        { path: '/local-llama', label: 'Local AI (llama.cpp)' },
        { path: '/revid', label: 'Revid.ai' },
        { path: '/cards', label: 'Card Library' },
        { path: '/settings', label: 'Settings' },
        { path: '/admin', label: 'Admin' },
    ];

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <img
                            src="/hapa-cat.png"
                            alt="Hapa logo"
                            className="w-8 h-8 rounded-md object-cover"
                        />
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Hapa
                        </h1>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`block px-4 py-2 rounded-lg transition-colors ${location.pathname === item.path
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>
            <main className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
