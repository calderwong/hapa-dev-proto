import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
    MessageSquare,
    Archive,
    Network,
    Cpu,
    Video,
    Library,
    Settings,
    ShieldAlert,
    BookOpen,
} from 'lucide-react';

interface NavItemConfig {
    path: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
    { path: '/', label: 'Chat', icon: MessageSquare },
    { path: '/cards', label: 'Card Library', icon: Library },
    { path: '/wormhole', label: 'Wormhole', icon: Archive },
    { path: '/wiki', label: 'Wiki', icon: BookOpen },
    { path: '/archives', label: 'Archives', icon: Archive },
    { path: '/local-llama', label: 'Local Llama', icon: Cpu },
    { path: '/revid', label: 'Revid (Video)', icon: Video },
    { path: '/revid-media', label: 'Revid Media', icon: Video },
    { path: '/p2p', label: 'P2P Network', icon: Network },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/admin', label: 'Admin', icon: ShieldAlert },
];

const Layout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <img
                            src="/hapa-cat.png"
                            alt="Hapa logo"
                            className="w-8 h-8 rounded-md object-cover"
                        />
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent leading-tight">
                                Hapa AI
                            </h1>
                            <span className="text-[11px] text-gray-400">Local + Cloud AI Toolkit</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                    {NAV_ITEMS.map((item) => (
                        <SidebarNavItem
                            key={item.path}
                            to={item.path}
                            label={item.label}
                            icon={item.icon}
                            active={location.pathname === item.path}
                        />
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-700 text-center text-[11px] text-gray-500">
                    v0.1.0-alpha
                </div>
            </aside>

            {/* Main content area */}
            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

interface SidebarNavItemProps {
    to: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    active: boolean;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ to, label, icon: Icon, active }) => {
    return (
        <Link
            to={to}
            className={`mx-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-medium'
                    : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-100'
            }`}
        >
            <Icon
                size={18}
                className={`${
                    active
                        ? 'text-white'
                        : 'text-gray-500 group-hover:text-gray-300'
                } transition-colors`}
            />
            <span className="truncate">{label}</span>
        </Link>
    );
};

export default Layout;
