import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

let firebaseApp: FirebaseApp | null = null;

export const validateFirebaseConfigJson = (configJson: string): { ok: boolean; config?: any } => {
    if (!configJson) return { ok: false };
    const raw = String(configJson).trim();
    if (!raw) return { ok: false };

    try {
        let config: any = JSON.parse(raw);
        if (typeof config === 'string') {
            const inner = config.trim();
            if (inner) config = JSON.parse(inner);
        }
        if (!config || typeof config !== 'object') return { ok: false };

        const apiKey = config.apiKey;
        const authDomain = config.authDomain;
        const projectId = config.projectId;

        const isNonPlaceholderString = (v: any) => typeof v === 'string' && v.trim().length > 0 && v.trim() !== '...';

        if (!isNonPlaceholderString(apiKey)) return { ok: false };
        if (!isNonPlaceholderString(authDomain)) return { ok: false };
        if (!isNonPlaceholderString(projectId)) return { ok: false };

        return { ok: true, config };
    } catch {
        return { ok: false };
    }
};

export const initFirebase = (configJson: string): boolean => {
    try {
        const parsed = validateFirebaseConfigJson(configJson);
        if (!parsed.ok) {
            console.error('Error initializing Firebase: invalid JSON config');
            return false;
        }
        const config = parsed.config;

        // If an app already exists, do not delete during startup (deleteApp is async and can cause
        // unhandled promise behavior if not awaited). Reuse the existing app.
        const apps = getApps();
        if (apps.length > 0) {
            firebaseApp = apps[0] as any;
            console.log('Firebase already initialized');
            return true;
        }

        firebaseApp = initializeApp(config);
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
};

export const getFirebaseApp = () => firebaseApp;
