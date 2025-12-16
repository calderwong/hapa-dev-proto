/// <reference types="vite/client" />

import 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'rux-button': any;
            'rux-input': any;
            'rux-textarea': any;
            'rux-select': any;
            'rux-option': any;
            'rux-status': any;
            'rux-notification': any;
            'rux-tabs': any;
            'rux-tab': any;
            'rux-icon': any;
            'rux-global-status-bar': any;
            'rux-card': any;
            'rux-modal': any;
            'rux-checkbox': any;
            'rux-switch': any;
            'rux-slider': any;
            'rux-progress': any;
        }
    }
}

export {};
