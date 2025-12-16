// @ts-nocheck
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import PetPortal from './pets/PetPortal';
import CardHand from './cards/CardHand';
import { DragCanvas } from './DragCanvas';
import { useDragCanvas } from '../contexts/DragCanvasContext';
import { createFlyingCardClone } from '../hooks/useAnime';
import { useNavigationHistory } from '../contexts/NavigationHistoryContext';

interface NavItemConfig {
    path: string;
    label: string;
    icon: string;
}

const NAV_ITEMS: NavItemConfig[] = [
    { path: '/', label: 'Chat', icon: 'chat' },
    { path: '/prototypes', label: 'Prototypes', icon: 'science' },
    { path: '/forge', label: "Hapa's Forge", icon: 'whatshot' },
    { path: '/thors-hamma', label: "Thor's Hamma", icon: 'satellite' },
    { path: '/cards', label: 'Card Library', icon: 'photo-library' },
    { path: '/nexus', label: '3D Nexus', icon: 'visibility' },
    { path: '/wormhole', label: 'Wormhole', icon: 'cloud-download' },

    { path: '/wiki', label: 'Wiki', icon: 'library-books' },
    { path: '/mermaid', label: 'Diagrams', icon: 'timeline' },
    { path: '/archives', label: 'Archives', icon: 'archive' },
    { path: '/local-llama', label: 'Local Llama', icon: 'memory' },
    { path: '/local-vision', label: 'Local Vision', icon: 'visibility' },
    { path: '/revid', label: 'Revid (Video)', icon: 'videocam' },
    { path: '/revid-media', label: 'Revid Media', icon: 'movie' },
    { path: '/p2p', label: 'P2P Network', icon: 'device-hub' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
    { path: '/admin', label: 'Admin', icon: 'security' },
    { path: '/pets', label: 'Sanctuary', icon: 'pets' },
    { path: '/camp', label: 'Camp Refactor', icon: 'school' },
    { path: '/pipeline', label: 'Hell Week', icon: 'satellite' },
    { path: '/flow', label: 'Flow Forger', icon: 'call-split' },
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

const useWormholeActivity = () => {
    const [state, setState] = React.useState<{ count: number; lastStep?: string | null }>(
        {
            count: 0,
            lastStep: null,
        },
    );

    React.useEffect(() => {
        const handleStart = (event: any) => {
            const step = event?.detail?.step || null;
            setState((prev) => ({
                count: prev.count + 1,
                lastStep: step || prev.lastStep || null,
            }));
        };

        const handleEnd = () => {
            setState((prev) => ({
                ...prev,
                count: Math.max(0, prev.count - 1),
            }));
        };

        window.addEventListener('wormhole-run-start', handleStart as EventListener);
        window.addEventListener('wormhole-run-end', handleEnd as EventListener);

        return () => {
            window.removeEventListener('wormhole-run-start', handleStart as EventListener);
            window.removeEventListener('wormhole-run-end', handleEnd as EventListener);
        };
    }, []);

    return {
        busy: state.count > 0,
        lastStep: state.lastStep,
    };
};

import {
    playHoverSound,
    playClickSound,
    toggleMute,
    getMuteState,
    playDropdownOpenSound,
    playDropdownHoverSound,
    playDropdownSelectSound,
} from '../utils/audio';

const Layout: React.FC = () => {
    const location = useLocation();
    const navHistory = useNavigationHistory();
    const wormholeActivity = useWormholeActivity();
    const [isMuted, setIsMuted] = React.useState(getMuteState());
    const { registerSnapZone, unregisterSnapZone, items: overlayItems, removeItem, selectedItemId } = useDragCanvas();
    const [menuStacks, setMenuStacks] = React.useState<Record<string, any[]>>({});
    const wormholeBusy = wormholeActivity.busy;
    const wormholeLabel = wormholeBusy
        ? `WH:${String(wormholeActivity.lastStep || 'RUN').toUpperCase()}`
        : 'WH:IDLE';

    const hasOverlayItems = overlayItems.length > 0;
    const showLocationTargets = true;
    const hasShootableSelected = !!selectedItemId || overlayItems.length === 1;

    const toFileUrl = React.useCallback((p?: string) => {
        if (!p) return null;
        const raw = String(p);
        if (raw.startsWith('file://')) return raw;
        if (raw.startsWith('data:')) return raw;
        if (raw.startsWith('blob:')) return raw;
        if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
        const normalized = raw.replace(/\\/g, '/');
        return `file:///${encodeURI(normalized)}`;
    }, []);

    const getBestThumbnail = React.useCallback((data: any) => {
        const d: any = data || {};
        const cardRecord: any = d.cardRecord || {};
        const rawRecord: any = d.raw || {};
        const kind = String(d.mediaKind || cardRecord.mediaKind || rawRecord.mediaKind || '');

        const isImagePath = (p: any) => {
            if (!p) return false;
            const s = String(p).toLowerCase();
            return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.webp') || s.endsWith('.gif') || s.endsWith('.bmp') || s.endsWith('.svg');
        };

        const isVideoPath = (p: any) => {
            if (!p) return false;
            const s = String(p).toLowerCase();
            return s.endsWith('.mp4') || s.endsWith('.webm') || s.endsWith('.mov') || s.endsWith('.m4v') || s.endsWith('.avi');
        };

        const normalizeMaybeLocalUrl = (v: any) => {
            if (!v) return null;
            const s = String(v).trim();
            if (!s) return null;

            if (s.startsWith('file://')) {
                if (!s.startsWith('file:///')) {
                    const after = s.slice('file://'.length).replace(/\\/g, '/');
                    if (/^[A-Za-z]:\//.test(after)) return `file:///${encodeURI(after)}`;
                }
                return s;
            }

            if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('http://') || s.startsWith('https://')) {
                return s;
            }

            return toFileUrl(s);
        };

        const normalizeCandidate = (v: any) => {
            if (!v) return null;
            if (Array.isArray(v)) {
                for (const x of v) {
                    const got = normalizeCandidate(x);
                    if (got) return got;
                }
                return null;
            }

            if (typeof v === 'object') {
                const obj: any = v;
                return (
                    normalizeMaybeLocalUrl(obj.url) ||
                    normalizeMaybeLocalUrl(obj.dataUrl) ||
                    normalizeMaybeLocalUrl(obj.localPath) ||
                    normalizeMaybeLocalUrl(obj.path) ||
                    normalizeMaybeLocalUrl(obj.remoteUrl) ||
                    normalizeMaybeLocalUrl(obj.uri) ||
                    normalizeMaybeLocalUrl(obj.src)
                );
            }

            return normalizeMaybeLocalUrl(v);
        };

        const records = [d, cardRecord, rawRecord];

        for (const rec of records) {
            const direct = rec?.thumbnail || rec?.imageUrl || rec?.thumbUrl || rec?.thumbnailUrl || rec?.poster;
            const got = normalizeCandidate(direct);
            if (got) return got;
        }

        for (const rec of records) {
            const sourceImagePath = rec?.sourceImage?.localPath;
            const got = normalizeCandidate(sourceImagePath);
            if (got) return got;
        }

        for (const rec of records) {
            const imageLocal = rec?.mediaLocalPath || rec?.image?.localPath || rec?.mediaPrompts?.generated_image_local;
            if (imageLocal && (kind === 'image' || isImagePath(imageLocal))) {
                const got = normalizeCandidate(imageLocal);
                if (got) return got;
            }
        }

        for (const rec of records) {
            const imageRemote = rec?.mediaRemoteUrl || rec?.image?.remoteUrl;
            if (imageRemote && (kind === 'image' || isImagePath(imageRemote))) {
                const got = normalizeCandidate(imageRemote);
                if (got) return got;
            }
        }

        for (const rec of records) {
            const videoLocal = rec?.video?.localPath || rec?.mediaLocalPath;
            if (videoLocal && (kind === 'video' || isVideoPath(videoLocal))) {
                const got = normalizeCandidate(videoLocal);
                if (got) return got;
            }
        }

        for (const rec of records) {
            const videoRemote = rec?.video?.remoteUrl || rec?.mediaRemoteUrl;
            if (videoRemote && (kind === 'video' || isVideoPath(videoRemote))) {
                const got = normalizeCandidate(videoRemote);
                if (got) return got;
            }
        }

        for (const rec of records) {
            const attachment = rec?.attachments?.[0];
            const got = normalizeCandidate(attachment);
            if (got) return got;
        }

        return null;
    }, [toFileUrl]);

    const handleAttachToLocation = React.useCallback((to: string, item: any) => {
        const d = item?.data || {};
        const bestThumb = getBestThumbnail(d);
        if ((import.meta as any)?.env?.DEV) {
            console.log('[MenuStack] attach', {
                to,
                type: item?.type,
                id: item?.id,
                bestThumb,
                dataThumb: d?.thumbnail,
                cardRecordThumb: d?.cardRecord?.thumbnail,
                rawThumb: d?.raw?.thumbnail,
            });
        }
        const entry = {
            id: item.id,
            type: item.type,
            cardId: d.cardId || d.id || item.id,
            name: d.name,
            thumbnail: bestThumb || undefined,
            mediaKind: d.mediaKind,
            createdAt: d.createdAt,
            provider: d.provider,
            attachedAt: Date.now(),
        };

        setMenuStacks((prev) => {
            const stack = Array.isArray(prev[to]) ? prev[to] : [];
            return {
                ...prev,
                [to]: [entry, ...stack],
            };
        });
    }, [getBestThumbnail]);

    const shootSelectedToLocation = React.useCallback((to: string, targetRect: DOMRect) => {
        const id = selectedItemId || (overlayItems.length === 1 ? overlayItems[0]?.id : null);
        if (!id) return false;

        const item = overlayItems.find((it) => it.id === id);
        if (!item) return false;

        const overlayEl = document.querySelector(`[data-overlay-card-id="${CSS.escape(String(item.id))}"]`) as HTMLElement | null;
        const startRect = overlayEl?.getBoundingClientRect();
        if (!startRect) return false;

        const startX = startRect.left + startRect.width / 2 - 30;
        const startY = startRect.top + startRect.height / 2 - 42;

        const targetX = targetRect.left + targetRect.width / 2 - 30;
        const targetY = targetRect.top + targetRect.height / 2 - 42;

        const bestThumb = getBestThumbnail(item?.data);
        createFlyingCardClone(bestThumb || undefined, startX, startY, targetX, targetY, () => {
            handleAttachToLocation(to, item);
            removeItem(item.id);
        });

        return true;
    }, [getBestThumbnail, handleAttachToLocation, overlayItems, removeItem, selectedItemId]);

    const [userAvatar, setUserAvatar] = React.useState<string | null>(null);

    const loadProfile = async () => {
        if (window.electronAPI?.getProfile) {
            const profile = await window.electronAPI.getProfile();
            if (profile?.avatarUrl) {
                setUserAvatar(profile.avatarUrl);
            }
        }
    };

    React.useEffect(() => {
        loadProfile();
        const handleUpdate = () => loadProfile();
        window.addEventListener('user-profile-update', handleUpdate);
        return () => window.removeEventListener('user-profile-update', handleUpdate);
    }, []);

    const handleMuteToggle = () => {
        const newState = toggleMute();
        setIsMuted(newState);
    };

    // Sound Effects integration
    React.useEffect(() => {
        let lastHovered: Element | null = null;
        let dropdownHoverOption: Element | null = null;
        let dropdownActiveSelect: HTMLElement | null = null;

        const findInPath = (event: Event, predicate: (node: HTMLElement) => boolean) => {
            const path = event.composedPath ? event.composedPath() : [];
            return path.find((node) => node instanceof HTMLElement && predicate(node as HTMLElement)) as HTMLElement | undefined;
        };

        const handlePointerOver = (event: PointerEvent) => {
            const interactive = findInPath(event, (el) =>
                el.matches('button, a, [role="button"], input[type="submit"], input[type="button"], .interactive'),
            );

            if (interactive) {
                if (interactive !== lastHovered) {
                    playHoverSound();
                    lastHovered = interactive;
                }
            } else {
                lastHovered = null;
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            const select = findInPath(event, (el) => el.tagName === 'RUX-SELECT');
            if (select && dropdownActiveSelect !== select) {
                dropdownActiveSelect = select;
                dropdownHoverOption = null;
                playDropdownOpenSound();
            } else if (!select) {
                dropdownActiveSelect = null;
                dropdownHoverOption = null;
            }
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (!dropdownActiveSelect) return;
            const element = document.elementFromPoint(event.clientX, event.clientY);
            if (!element) {
                dropdownHoverOption = null;
                return;
            }
            const option = element.closest('.rux-select__option');
            if (option && option !== dropdownHoverOption) {
                playDropdownHoverSound();
                dropdownHoverOption = option;
            } else if (!option) {
                dropdownHoverOption = null;
            }
        };

        const handleClick = (event: MouseEvent) => {
            const overlayCard = findInPath(event, (el) => el.hasAttribute('data-overlay-card'));
            if (overlayCard) return;

            const interactive = findInPath(event, (el) =>
                el.matches('button, a, [role="button"], input[type="submit"], input[type="button"], .interactive'),
            );
            if (interactive) {
                playClickSound();
            }
        };

        const handleDropdownSelect = (event: Event) => {
            const select = findInPath(event, (el) => el.tagName === 'RUX-SELECT');
            if (select && dropdownActiveSelect === select) {
                playDropdownSelectSound();
                dropdownHoverOption = null;
                dropdownActiveSelect = null;
            }
        };

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                dropdownHoverOption = null;
                dropdownActiveSelect = null;
            }
        };

        window.addEventListener('pointerover', handlePointerOver, true);
        window.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('pointermove', handlePointerMove, true);
        window.addEventListener('click', handleClick, true);
        window.addEventListener('ruxchange', handleDropdownSelect as EventListener, true);
        window.addEventListener('keydown', handleKeydown, true);

        return () => {
            window.removeEventListener('pointerover', handlePointerOver, true);
            window.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('pointermove', handlePointerMove, true);
            window.removeEventListener('click', handleClick, true);
            window.removeEventListener('ruxchange', handleDropdownSelect as EventListener, true);
            window.removeEventListener('keydown', handleKeydown, true);
        };
    }, []);

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            <DragCanvas />
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
                                src="/Paramation_Logo.png"
                                alt="Paramation logo"
                                className="relative w-12 h-12 rounded-lg object-contain bg-gray-800 border border-gray-600 shadow-xl ring-1 ring-white/10"
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

                <nav className="flex-1 py-4 space-y-1 overflow-y-auto sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <SidebarNavItem
                            key={item.path}
                            to={item.path}
                            label={item.label}
                            icon={item.icon}
                            active={location.pathname === item.path}
                            stack={menuStacks[item.path]}
                            showLocationTargets={showLocationTargets && (hasOverlayItems || true)}
                            registerSnapZone={registerSnapZone}
                            unregisterSnapZone={unregisterSnapZone}
                            onAttachToLocation={handleAttachToLocation}
                            onShootSelectedToLocation={shootSelectedToLocation}
                            hasShootableSelected={hasShootableSelected}
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
                    <div className="flex items-center w-full gap-4 px-4">
                        {/* Pet Portal - mini pet habitat */}
                        <div className="flex-shrink-0">
                            <PetPortal />
                        </div>

                        <button
                            onClick={() => navHistory.goBack()}
                            disabled={!navHistory.canGoBack}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-mono transition-all ${
                                navHistory.canGoBack
                                    ? 'border-cyan-500/30 bg-cyan-900/20 text-cyan-200 hover:border-cyan-400/50 hover:bg-cyan-900/30'
                                    : 'border-gray-800 bg-gray-900/30 text-gray-600 cursor-not-allowed'
                            }`}
                            title={navHistory.canGoBack ? 'Back (Alt+←)' : 'Back'}
                        >
                            <rux-icon icon="chevron-left" size="extra-small" className={navHistory.canGoBack ? 'text-cyan-300' : 'text-gray-700'}></rux-icon>
                            BACK
                        </button>

                        {/* The Hand - Card Dock (next to Pet) */}
                        <div className="flex-shrink-0">
                            <CardHand />
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* System Metrics */}
                        <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-gray-400">
                            <div className="flex items-center gap-1.5" title="Network Status">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span>
                                <span className="tracking-wider">NET:ONLINE</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Wormhole Activity">
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${wormholeBusy
                                        ? 'bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.7)]'
                                        : 'bg-gray-600'
                                        }`}
                                ></span>
                                <span className="tracking-wider">{wormholeLabel}</span>
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
                                onClick={handleMuteToggle}
                                className="flex items-center gap-1.5 hover:text-white transition-colors"
                                title={isMuted ? "Unmute Audio" : "Mute Audio"}
                            >
                                <rux-icon
                                    key={isMuted ? 'mute' : 'vol'}
                                    icon={isMuted ? "volume-mute" : "volume-up"}
                                    size="extra-small"
                                    className={`transition-colors ${isMuted ? 'text-gray-600' : 'text-astro-primary'}`}
                                ></rux-icon>
                            </button>
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
                            <Link to="/profile" className="w-8 h-8 rounded-full bg-gradient-to-tr from-astro-primary to-purple-600 p-[1px] hover:scale-105 transition-transform cursor-pointer">
                                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                                    {userAvatar ? (
                                        <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <rux-icon icon="person" size="small" className="text-white"></rux-icon>
                                    )}
                                </div>
                            </Link>
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
    stack?: any[];
    showLocationTargets: boolean;
    registerSnapZone: (zone: any) => void;
    unregisterSnapZone: (id: string) => void;
    onAttachToLocation: (to: string, item: any) => void;
    onShootSelectedToLocation: (to: string, targetRect: DOMRect) => boolean;
    hasShootableSelected: boolean;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
    to,
    label,
    icon,
    active,
    stack,
    showLocationTargets,
    registerSnapZone,
    unregisterSnapZone,
    onAttachToLocation,
    onShootSelectedToLocation,
    hasShootableSelected,
}) => {
    const isExperimental = to === '/prototypes';
    const experimentalClass = isExperimental
        ? (active
            ? 'bg-red-900/30 text-red-100 border border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
            : 'text-red-400 hover:text-red-200 hover:bg-red-900/20 border border-red-900/40')
        : (active
            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-medium'
            : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-100');

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const padRef = React.useRef<HTMLButtonElement | null>(null);
    const stackCount = Array.isArray(stack) ? stack.length : 0;
    const top = stackCount > 0 ? stack![0] : null;
    const topThumb = top?.thumbnail ? String(top.thumbnail) : '';
    const topIsVideo = !!topThumb && (topThumb.toLowerCase().endsWith('.mp4') || topThumb.toLowerCase().endsWith('.webm') || topThumb.toLowerCase().endsWith('.mov') || topThumb.toLowerCase().endsWith('.m4v') || topThumb.toLowerCase().endsWith('.avi'));

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const id = `menu-location:${to}`;

        const update = () => {
            const rect = el.getBoundingClientRect();
            registerSnapZone({
                id,
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                threshold: 90,
                onSnap: (item: any) => onAttachToLocation(to, item),
            });
        };

        update();

        const ro = new ResizeObserver(() => update());
        ro.observe(el);

        const navEl = el.closest('.sidebar-nav');
        const onScroll = () => update();
        navEl?.addEventListener('scroll', onScroll, { passive: true } as any);

        window.addEventListener('resize', update);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
            navEl?.removeEventListener('scroll', onScroll as any);
            unregisterSnapZone(id);
        };
    }, [onAttachToLocation, registerSnapZone, to, unregisterSnapZone]);

    return (
        <div
            ref={containerRef}
            className={`mx-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative ${experimentalClass}`}
        >
            <Link
                to={to}
                className="flex items-center gap-3 min-w-0 flex-1"
            >
                <div
                    className={`${active
                        ? (isExperimental ? 'text-red-400 animate-spin-slow' : 'text-white animate-neon-breathe')
                        : (isExperimental ? 'text-red-500/70 group-hover:text-red-400' : 'text-gray-500 group-hover:text-gray-300 group-hover:animate-neon-breathe')
                        } transition-colors flex-shrink-0 flex items-center justify-center`}
                >
                    <rux-icon icon={icon} size="small"></rux-icon>
                </div>
                <span className="truncate leading-none pt-0.5">{label}</span>
            </Link>

            <div className="relative flex-shrink-0">
                <button
                    ref={padRef}
                    type="button"
                    onClick={(e) => {
                        if (!padRef.current) return;
                        if (!hasShootableSelected) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = padRef.current.getBoundingClientRect();
                        onShootSelectedToLocation(to, rect);
                    }}
                    title={hasShootableSelected ? 'Shoot selected card here' : 'Drop a card here'}
                    className={`relative w-16 h-11 rounded-md border overflow-hidden transition-all duration-200 ${stackCount > 0
                        ? 'border-red-400/70 shadow-[0_0_18px_rgba(239,68,68,0.35)] bg-red-950/20'
                        : showLocationTargets
                            ? 'border-red-900/40 bg-gray-900/30 opacity-75 group-hover:opacity-95'
                            : 'border-gray-700/40 bg-gray-900/20 opacity-35 group-hover:opacity-60'
                        } ${hasShootableSelected ? 'ring-1 ring-cyan-300/40 shadow-[0_0_16px_rgba(34,211,238,0.18)]' : ''}`}
                >
                    {stackCount > 1 && (
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 rounded-md border border-red-400/15 opacity-60" style={{ transform: 'translate(3px, -2px)' }} />
                            <div className="absolute inset-0 rounded-md border border-red-400/10 opacity-40" style={{ transform: 'translate(5px, -4px)' }} />
                        </div>
                    )}

                    {top?.thumbnail ? (
                        <div className="absolute inset-0">
                            {topIsVideo ? (
                                <video
                                    src={topThumb}
                                    className="absolute left-1/2 top-1/2 w-[72px] h-[54px] object-cover -translate-x-1/2 -translate-y-1/2 rotate-90"
                                    muted
                                    playsInline
                                    loop
                                    autoPlay
                                    preload="metadata"
                                />
                            ) : (
                                <img
                                    src={top.thumbnail}
                                    alt={top.name || top.cardId || 'Card'}
                                    className="absolute left-1/2 top-1/2 w-[72px] h-[54px] object-cover -translate-x-1/2 -translate-y-1/2 rotate-90"
                                    draggable={false}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/35" />
                            <div className="absolute inset-0 ring-1 ring-white/5" />
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`w-6 h-6 rounded border ${showLocationTargets ? 'border-red-500/25 bg-red-950/15' : 'border-gray-700 bg-gray-900/30'} ${hasShootableSelected ? 'border-cyan-300/35 shadow-[0_0_18px_rgba(34,211,238,0.12)]' : ''}`} />
                        </div>
                    )}

                    {(showLocationTargets || stackCount > 0) && (
                        <div className="absolute inset-0 pointer-events-none">
                            <div className={`${stackCount > 0 ? 'opacity-0' : 'opacity-100'} absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent`} />
                        </div>
                    )}
                </button>

                {stackCount > 0 && (
                    <div className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.35)]">
                        {stackCount}
                    </div>
                )}

                {stackCount > 0 && (
                    <div className="absolute right-16 top-1/2 -translate-y-1/2 hidden group-hover:block pointer-events-none">
                        <div className="w-64 rounded-xl bg-gray-950/92 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.18)] backdrop-blur-sm p-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-red-200 px-1">{label} Stack</div>
                            <div className="mt-2 space-y-1 max-h-56 overflow-hidden">
                                {stack!.slice(0, 8).map((c: any, idx: number) => (
                                    <div key={`${c.cardId}-${idx}`} className="flex items-center gap-2 px-1 py-1 rounded-lg bg-gray-900/30 border border-gray-800/40">
                                        <div className="w-9 h-6 rounded-md overflow-hidden border border-red-400/20 bg-gray-900/30 flex-shrink-0">
                                            {c.thumbnail ? (
                                                (String(c.thumbnail).toLowerCase().endsWith('.mp4') || String(c.thumbnail).toLowerCase().endsWith('.webm') || String(c.thumbnail).toLowerCase().endsWith('.mov') || String(c.thumbnail).toLowerCase().endsWith('.m4v') || String(c.thumbnail).toLowerCase().endsWith('.avi'))
                                                    ? <video src={c.thumbnail} className="w-full h-full object-cover" muted playsInline loop autoPlay preload="metadata" />
                                                    : <img src={c.thumbnail} alt={c.name || c.cardId} className="w-full h-full object-cover" draggable={false} />
                                            ) : (
                                                <div className="w-full h-full" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] text-gray-200 truncate">{c.name || c.cardId}</div>
                                            <div className="text-[9px] text-gray-500 font-mono truncate">#{idx + 1}</div>
                                        </div>
                                    </div>
                                ))}
                                {stackCount > 8 && (
                                    <div className="text-[10px] text-gray-500 font-mono px-1">+{stackCount - 8} more…</div>
                                )}
                            </div>
                            <div className="mt-2 text-[9px] text-gray-500 font-mono px-1">Priority: top → bottom</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Layout;
