import { AnalysisJob, AudioStem } from '../types';
import { sessionService } from './sessionService';
import { vibeAnalysisService } from './vibeAnalysisService';
import { geminiService } from './geminiService';
import { audioExcerptService } from './audioExcerptService';
import { v4 as uuidv4 } from 'uuid';

class AnalysisQueueService {
    private queue: AnalysisJob[] = [];
    private isProcessing = false;
    private jobHistory: Map<string, AnalysisJob> = new Map(); // Cache completed jobs
    private bufferCache: Map<string, AudioBuffer> = new Map();

    // --- Configuration ---
    public config = {
        autoDspOnImport: true,
        autoLabelOnImport: false,
        maxExcerptSeconds: 10
    };

    getQueueStatus() {
        return {
            pending: this.queue.filter(j => j.status === 'PENDING').length,
            running: this.isProcessing,
            historySize: this.jobHistory.size
        };
    }

    async enqueue(
        kind: AnalysisJob['kind'], 
        target: AnalysisJob['target'],
        priority: number = 1
    ) {
        // Construct canonical job spec for hashing
        const spec = { kind, target, version: "v1" }; 
        const jobId = await sessionService.computeStringHash(JSON.stringify(spec));

        // Check if already done or pending
        if (this.jobHistory.has(jobId)) {
            const existing = this.jobHistory.get(jobId);
            if (existing && existing.status === 'COMPLETED') return; // Dedupe
        }
        if (this.queue.find(j => j.jobId === jobId)) return; // Already queued

        const job: AnalysisJob = {
            jobId,
            kind,
            target,
            versions: {
                dspVersion: "1.0.0",
                promptTemplateVersion: kind === 'GEMINI_AUDIO_LABEL' ? "v1_label" : undefined
            },
            priority,
            createdAt: new Date().toISOString(),
            status: 'PENDING'
        };

        this.queue.push(job);
        this.queue.sort((a, b) => b.priority - a.priority); // High priority first
        
        sessionService.logEvent('ANALYSIS_JOB_ENQUEUED', { jobId, kind, target });
        this.processNext();
    }

    // Overloaded enqueue for immediate buffer access
    public async enqueueWithBuffer(
        kind: AnalysisJob['kind'],
        target: AnalysisJob['target'],
        buffer: AudioBuffer
    ) {
        // We wrap the buffer in a resolver or cache it temporarily
        const jobId = await sessionService.computeStringHash(JSON.stringify({ kind, target, version: "v1" }));
        
        // Cache buffer for this job
        this.bufferCache.set(jobId, buffer);
        
        await this.enqueue(kind, target);
    }

    private async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const job = this.queue.shift()!;
        job.status = 'RUNNING';
        this.jobHistory.set(job.jobId, job); // Track it
        
        sessionService.logEvent('ANALYSIS_JOB_STARTED', { jobId: job.jobId });

        try {
            if (job.kind === 'DSP_FINGERPRINT') {
                await this.runDspJob(job);
            } else if (job.kind === 'GEMINI_AUDIO_LABEL') {
                await this.runLabelJob(job);
            }
            job.status = 'COMPLETED';
            sessionService.logEvent('ANALYSIS_JOB_COMPLETE', { jobId: job.jobId, resultId: job.resultId });
        } catch (error: any) {
            console.error(`Job ${job.jobId} failed:`, error);
            job.status = 'FAILED';
            job.error = error.message;
            sessionService.logEvent('ANALYSIS_JOB_FAILED', { jobId: job.jobId, error: error.message });
        } finally {
            this.isProcessing = false;
            // Next
            setTimeout(() => this.processNext(), 100);
        }
    }

    private async runDspJob(job: AnalysisJob) {
        // Resolve Buffer
        let buffer = this.bufferCache.get(job.jobId);
        if (!buffer) {
             buffer = await this.resolveBuffer(job.target);
        }

        if (!buffer) throw new Error("Audio buffer not found for target");

        const slice = job.target.slice ? {
            start: job.target.slice.start_ms / 1000,
            end: job.target.slice.end_ms / 1000
        } : undefined;

        // Run Analysis
        const fp = await vibeAnalysisService.analyzeAudioBuffer(
            buffer, 
            job.target.scope as any, 
            job.target.assetHashes,
            slice
        );

        // Store result
        sessionService.addVibeFingerprint(fp);
        job.resultId = sessionService.computeStringHashSync(fp.vector_int8_b64); // rough id
        
        // Clean cache
        this.bufferCache.delete(job.jobId);
    }

    private async runLabelJob(job: AnalysisJob) {
        // Resolve Buffer
        let buffer = this.bufferCache.get(job.jobId);
        if (!buffer) {
             buffer = await this.resolveBuffer(job.target);
        }

        if (!buffer) throw new Error("Audio buffer not found for target");

        // Create Excerpt
        const { blob, start, end } = await audioExcerptService.createSmartExcerpt(buffer, this.config.maxExcerptSeconds);
        
        // Compute Excerpt Hash
        const excerptHash = await sessionService.computeHash(blob);

        // Check if we already have a label for this excerpt? 
        // For now, GeminiService handles PromptPack caching, but we can verify here.

        // Call Gemini
        const label = await geminiService.analyzeAudioVibeExcerpt(blob, `Excerpt ${excerptHash.substring(0,8)}`, { excerptHash });
        
        if (label) {
            // Mint Label Card (logic in sessionService ideally, but for now we store in volatile memory)
            sessionService.addVibeLabel(label, job.target.assetHashes[0]); // Simple storage
        }
        
        // Clean cache
        this.bufferCache.delete(job.jobId);
    }

    private async resolveBuffer(target: AnalysisJob['target']): Promise<AudioBuffer | null> {
        // Find stem by ID first (runtime)
        if (target.stemId) {
            // NOTE: sessionService.mediaClips might have it.
            const clip = sessionService.getMediaClips().find(c => c.hash === target.assetHashes[0]);
            if (clip && clip.blob) {
                 const arrayBuffer = await clip.blob.arrayBuffer();
                 // We need a way to decode without creating a full audio context if possible, 
                 // but we can assume window.AudioContext exists in browser.
                 // This is a bit heavy for a service if called frequently without cache.
                 const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                 return await ctx.decodeAudioData(arrayBuffer);
            }
        }
        
        return null;
    }
}

export const analysisQueueService = new AnalysisQueueService();