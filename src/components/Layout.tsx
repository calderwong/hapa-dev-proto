// @ts-nocheck
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

interface NavItemConfig {
    path: string;
    label: string;
    icon: string;
}

const NAV_ITEMS: NavItemConfig[] = [
    { path: '/', label: 'Chat', icon: 'chat' },
    { path: '/cards', label: 'Card Library', icon: 'photo-library' },
    { path: '/wormhole', label: 'Wormhole', icon: 'cloud-download' },

    { path: '/wiki', label: 'Wiki', icon: 'library-books' },
    { path: '/archives', label: 'Archives', icon: 'archive' },
    { path: '/local-llama', label: 'Local Llama', icon: 'memory' },
    { path: '/revid', label: 'Revid (Video)', icon: 'videocam' },
    { path: '/revid-media', label: 'Revid Media', icon: 'movie' },
    { path: '/p2p', label: 'P2P Network', icon: 'device-hub' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
    { path: '/admin', label: 'Admin', icon: 'security' },
];

const SystemClock = () => {
    const [time, setTime] = React.useState(new Date());
    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="font-mono text-sm text-astro-primary tracking-widest flex items-center gap-2 border-l border-gray-700 pl-4">
            <rux-icon icon="access-time" size="extra-small" className="text-astro-primary/70"></rux-icon>
            {time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
        </div>
    );
};

const Layout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="relative p-6 border-b border-gray-700 overflow-hidden group bg-gray-900/50">
                    {/* Background decorative elements */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-astro-primary to-purple-500"></div>
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-astro-primary/10 rounded-full blur-3xl group-hover:bg-astro-primary/20 transition-colors duration-700"></div>

                    <div className="relative flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 bg-astro-primary blur-md opacity-20 rounded-lg group-hover:opacity-40 transition-opacity duration-500"></div>
                            <img
                                src="/hapa-cat.png"
                                alt="Hapa logo"
                                className="relative w-12 h-12 rounded-lg object-cover border border-gray-600 shadow-xl ring-1 ring-white/10"
                            />
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-gray-800 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                        </div>

                        <div className="flex flex-col min-w-0">
                            <h1 className="text-lg font-bold text-white tracking-wider flex items-center gap-1 leading-none mb-1.5">
                                HAPA <span className="text-astro-primary font-mono font-normal opacity-90">AI</span>
                            </h1>
                            <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                    <span className="w-0.5 h-2 bg-astro-primary/40 rounded-full"></span>
                                    <span className="w-0.5 h-3 bg-astro-primary/60 rounded-full"></span>
                                    <span className="w-0.5 h-2 bg-astro-primary/40 rounded-full"></span>
                                </div>
                                <span className="text-[9px] text-blue-200/60 uppercase tracking-[0.2em] font-medium truncate">
                                    Ops Terminal
                                </span>
                            </div>
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
            <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-gray-900">
                <rux-global-status-bar appname="Hapa AI" className="border-b border-gray-800/50">
                    <div className="flex items-center justify-end w-full gap-6 px-4">
                        {/* System Metrics */}
                        <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-gray-400">
                            <div className="flex items-center gap-1.5" title="Network Status">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span>
                                <span className="tracking-wider">NET:ONLINE</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="System Status">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]"></span>
                                <span className="tracking-wider">SYS:NOMINAL</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Memory Usage">
                                <rux-icon icon="memory" size="extra-small" className="text-gray-500"></rux-icon>
                                <span className="tracking-wider">MEM:32%</span>
                            </div>
                            <button
                                onClick={() => window.electronAPI?.toggleDevTools()}
                                className="flex items-center gap-1.5 hover:text-white transition-colors"
                                title="Toggle Developer Tools"
                            >
                                <rux-icon icon="bug-report" size="extra-small" className="text-gray-500 hover:text-astro-primary"></rux-icon>
                            </button>
                        </div>

                        <SystemClock />

                        <div className="flex items-center gap-3 border-l border-gray-700 pl-4">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-astro-primary to-purple-600 p-[1px]">
                                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                                    <rux-icon icon="person" size="small" className="text-white"></rux-icon>
                                </div>
                            </div>
                        </div>
                    </div>
                </rux-global-status-bar>
                <div className="flex-1 overflow-auto relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

interface SidebarNavItemProps {
    to: string;
    label: string;
    icon: string;
    active: boolean;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ to, label, icon, active }) => {
    return (
        <Link
            to={to}
            className={`mx-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${active
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-medium'
                : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-100'
                }`}
        >
            <div
                className={`${active
                    ? 'text-white'
                    : 'text-gray-500 group-hover:text-gray-300'
                    } transition-colors flex-shrink-0 flex items-center justify-center`}
            >
                <rux-icon icon={icon} size="small"></rux-icon>
            </div>
            <span className="truncate leading-none pt-0.5">{label}</span>
        </Link>
    );
};

export default Layout;
