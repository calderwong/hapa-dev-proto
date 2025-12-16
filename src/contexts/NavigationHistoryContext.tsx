import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type HistoryEntry = {
    pathname: string;
    search: string;
    hash: string;
};

type NavigationHistoryState = {
    canGoBack: boolean;
    goBack: () => void;
    goBackOr: (fallback: string) => void;
};

const NavigationHistoryContext = React.createContext<NavigationHistoryState | null>(null);

export const NavigationHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const stackRef = React.useRef<HistoryEntry[]>([]);
    const isGoingBackRef = React.useRef(false);
    const [canGoBack, setCanGoBack] = React.useState(false);

    React.useEffect(() => {
        const nextEntry: HistoryEntry = {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        };

        const stack = stackRef.current;
        const prev = stack.length > 0 ? stack[stack.length - 1] : null;

        const isSameAsPrev = !!prev && prev.pathname === nextEntry.pathname && prev.search === nextEntry.search && prev.hash === nextEntry.hash;

        if (isGoingBackRef.current) {
            isGoingBackRef.current = false;
            if (!isSameAsPrev) {
                stack.push(nextEntry);
            }
        } else {
            if (!isSameAsPrev) {
                stack.push(nextEntry);
            }
        }

        if (stack.length > 64) {
            stack.splice(0, stack.length - 64);
        }

        setCanGoBack(stack.length > 1);
    }, [location.hash, location.pathname, location.search]);

    const goBack = React.useCallback(() => {
        const stack = stackRef.current;
        if (stack.length <= 1) {
            return;
        }

        stack.pop();
        const prev = stack[stack.length - 1];
        if (!prev) return;

        isGoingBackRef.current = true;
        navigate(`${prev.pathname}${prev.search}${prev.hash}`);
        setCanGoBack(stack.length > 1);
    }, [navigate]);

    const goBackOr = React.useCallback(
        (fallback: string) => {
            const stack = stackRef.current;
            if (stack.length > 1) {
                goBack();
                return;
            }
            navigate(fallback);
        },
        [goBack, navigate],
    );

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.altKey || event.key !== 'ArrowLeft') return;
            const target = event.target as HTMLElement | null;
            const tag = target?.tagName ? String(target.tagName).toLowerCase() : '';
            const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;
            if (isTyping) return;

            const stack = stackRef.current;
            if (stack.length <= 1) return;

            event.preventDefault();
            goBack();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [goBack]);

    const value = React.useMemo<NavigationHistoryState>(
        () => ({
            canGoBack,
            goBack,
            goBackOr,
        }),
        [canGoBack, goBack, goBackOr],
    );

    return <NavigationHistoryContext.Provider value={value}>{children}</NavigationHistoryContext.Provider>;
};

export const useNavigationHistory = (): NavigationHistoryState => {
    const ctx = React.useContext(NavigationHistoryContext);
    if (!ctx) {
        return {
            canGoBack: false,
            goBack: () => undefined,
            goBackOr: (fallback: string) => {
                window.location.hash = `#${fallback.startsWith('/') ? fallback : `/${fallback}`}`;
            },
        };
    }
    return ctx;
};
