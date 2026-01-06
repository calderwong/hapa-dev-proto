import { v4 as uuidv4 } from 'uuid';
import { sessionService } from './sessionService';

export type TimelineEventHandler = (payload: any, time: number) => void;

interface ScheduledEvent {
    id: string;
    time: number; // Transport time in seconds
    type: string;
    payload: any;
    handler: TimelineEventHandler;
    insertionOrder: number;
}

class TimelineScheduler {
    private events: ScheduledEvent[] = [];
    private eventCounter: number = 0;
    private lastTime: number = 0;

    // Schedule an event at a specific transport time
    schedule(time: number, type: string, payload: any, handler: TimelineEventHandler) {
        this.events.push({
            id: uuidv4(),
            time,
            type,
            payload,
            handler,
            insertionOrder: this.eventCounter++
        });
        
        // Keep sorted: Time ASC, then Insertion ASC for determinism
        this.events.sort((a, b) => {
            if (Math.abs(a.time - b.time) < 0.0001) return a.insertionOrder - b.insertionOrder;
            return a.time - b.time;
        });
    }

    // Advance time and execute due events
    tick(currentTime: number) {
        // If we jumped backwards significantly, it's a seek. 
        // We do NOT execute past events during a backwards seek, we just reset the cursor.
        // Consumers must re-schedule or reset state externally if needed.
        if (currentTime < this.lastTime) {
            this.lastTime = currentTime;
            return;
        }

        while (this.events.length > 0 && this.events[0].time <= currentTime) {
            const evt = this.events.shift();
            if (evt) {
                try {
                    evt.handler(evt.payload, evt.time);
                    sessionService.logEvent('EVENT_EXECUTED', { 
                        t: evt.time, 
                        type: evt.type, 
                        // Simplified payload log to avoid huge objects
                        payloadHash: JSON.stringify(evt.payload).length 
                    }, 'SYSTEM');
                } catch (e) {
                    console.error("Event execution failed", e);
                }
            }
        }
        
        this.lastTime = currentTime;
    }

    // Remove future events (useful on seek/stop if events are transient)
    // If keepPersistent is true, we might filter. For now, clear all > fromTime.
    clearFuture(fromTime: number) {
        this.events = this.events.filter(e => e.time <= fromTime);
        this.lastTime = fromTime;
    }
    
    cancelAll() {
        this.events = [];
        this.eventCounter = 0;
    }
    
    getQueueLength() {
        return this.events.length;
    }
}

export const timelineScheduler = new TimelineScheduler();