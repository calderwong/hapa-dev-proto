import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

let firebaseApp: FirebaseApp | null = null;

export const initFirebase = (configJson: string): boolean => {
    try {
        if (!configJson) return false;
        let config: any;
        try {
            config = JSON.parse(configJson);
        } catch (e) {
            console.error('Error initializing Firebase: invalid JSON config');
            return false;
        }

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
