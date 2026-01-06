import { ShowScriptV1, ShowEvent, VisualSettings, AudioFxSettings } from "../types";
import { timelineScheduler } from "./timelineScheduler";
import { audioService } from "./audioService";

class ShowScriptEngine {
    private activeScript: ShowScriptV1 | null = null;
    
    // Bind handlers to instance
    constructor() {
        this.handleEvent = this.handleEvent.bind(this);
        this.handleEndFx = this.handleEndFx.bind(this);
    }

    setActiveScript(script: ShowScriptV1) {
        this.activeScript = script;
        const now = audioService.getCurrentTime();
        
        // Schedule all script events into the timeline
        // Events are relative to NOW if they have relative time, 
        // OR relative to script start. Assuming script.events[].t is offset from start.
        
        script.events.forEach(e => {
            const triggerTime = now + e.t;
            timelineScheduler.schedule(triggerTime, e.type, e, this.handleEvent);
        });
    }

    // Called by TimelineScheduler
    private handleEvent(e: ShowEvent, time: number) {
        // We dispatch events to the UI via custom events or direct callbacks if we had access to setters.
        // Since this service is a singleton and doesn't hold React state setters directly,
        // we use window dispatch or expect App to pass setters.
        // BUT App passes setters to `update` method in previous design. 
        // To support `timelineScheduler`, we need to dispatch events that App listens to, 
        // OR we register a global handler in App that delegates to this engine.
        
        // Let's use CustomEvent dispatch for decoupling from React state here.
        // App.tsx needs to listen to 'hapa-show-event'.
        
        window.dispatchEvent(new CustomEvent('hapa-show-event', { detail: e }));

        // Handle Duration Logic (e.g. Stutter OFF)
        if (e.duration && e.duration > 0) {
            // Schedule the "OFF" event
            timelineScheduler.schedule(time + e.duration, 'END_FX', e, this.handleEndFx);
        }
    }

    private handleEndFx(e: ShowEvent, time: number) {
        window.dispatchEvent(new CustomEvent('hapa-show-event-end', { detail: e }));
    }

    // Legacy update method - deprecated/noop as we use scheduler now
    update(
        currentTime: number,
        setVisualSettings: any,
        setAudioSettings: any,
        setFormation: any
    ) {
        // No-op: Scheduling handles it.
        // But for migration, App might still call this.
    }
}

export const showScriptEngine = new ShowScriptEngine();