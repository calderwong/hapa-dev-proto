import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';

let firebaseApp: FirebaseApp | null = null;

export const initFirebase = (configJson: string): boolean => {
    try {
        if (!configJson) return false;
        const config = JSON.parse(configJson);

        // If an app already exists, delete it to re-initialize (e.g. if config changed)
        const apps = getApps();
        if (apps.length > 0) {
            apps.forEach(app => deleteApp(app));
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
