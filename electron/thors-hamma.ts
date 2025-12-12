import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getVertexAIClient,
  isVertexAIConfigured,
  VertexAIClient,
  MODEL_SHORTHAND_MAP,
  createModelProvenance
} from './vertexai';
import {
  AimlApiClient,
  isAimlApiConfigured,
  AIMLAPI_MODEL_MAP
} from './aimlapi';
import Store from 'electron-store';
import { createCore, appendToCore } from './p2p';
import { emitCardEvent } from './persistence';

const CARD_LIBRARY_CORE_NAME = 'card-library';

const store: any = new Store();

// Types
interface ThorLog {
  source: 'SYS' | 'NET' | 'CAM' | 'LEO' | 'THOR' | 'ERR';
  message: string;
}

interface HandCardLite {
  cardId: string;
  name?: string;
  lore?: string;
  skills?: Array<{ name: string; description: string; type: string }>;
  desires?: string;
  truths?: string[];
  tier?: number;
}

interface LeoAnalysis {
  title: string;
  summary: string;
  category: string;
  core_value: string;
  loot_potential: Array<{ concept: string; why_valuable: string; use_case: string }>;
  target_audience: string;
  related_domains: string[];
  // Hand context guidance for Thor
  hand_synergies: Array<{
    hand_card_id: string;
    hand_card_name: string;
    relevant_skills: string[];
    connection: string;
  }>;
  forging_priority: string; // What Thor should prioritize based on hand context
}

export class ThorsHammaManager {
  private window: BrowserWindow | null = null;
  private currentUrl: string = '';

  constructor() { }

  public setWindow(window: BrowserWindow) {
    this.window = window;
  }

  private sendUpdate(type: 'log' | 'complete' | 'error', payload: any) {
    if (this.window) {
      this.window.webContents.send('thor-update', { type, payload });
    }
  }

  private log(source: ThorLog['source'], message: string) {
    console.log(`[Thor:${source}] ${message}`);
    this.sendUpdate('log', { source, message });
  }

  public async processUrl(url: string, handCards: HandCardLite[]) {
    try {
      this.currentUrl = url;
      this.log('SYS', `Initializing Sequence for: ${url}`);

      // 1. Capture Phase
      const { html, screenshotPath } = await this.captureSite(url);

      // 2. Leo Phase (Analysis + Hand Context)
      const leoContext = await this.runLeo(html, handCards);

      // 3. Thor Phase (Synthesis with Leo's guidance)
      const { setData, cardDataList, siblingLinks } = await this.runThor(leoContext, handCards);

      // 4. Fabrication Phase (Hypercore + Sibling Links)
      const forgeResult = await this.fabricateAssets(url, screenshotPath, setData, cardDataList, siblingLinks);

      // Send complete with forged card data for immediate display
      this.sendUpdate('complete', forgeResult);

    } catch (error: any) {
      this.log('ERR', `Sequence Failed: ${error.message}`);
      this.sendUpdate('error', { message: error.message });
    }
  }

  private async captureSite(url: string): Promise<{ html: string, screenshotPath: string }> {
    this.log('CAM', 'Spawning Scout Drone (Offscreen Window)...');

    return new Promise((resolve, reject) => {
      const captureWin = new BrowserWindow({
        show: false,
        width: 1200,
        height: 800,
        webPreferences: {
          offscreen: true,
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Timeout safety
      const timeout = setTimeout(() => {
        if (!captureWin.isDestroyed()) captureWin.destroy();
        reject(new Error('Connection Timed Out'));
      }, 30000);

      captureWin.loadURL(url)
        .then(() => {
          this.log('NET', 'Uplink Established. Rendering...');
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(new Error(`Uplink Failed: ${err.message}`));
        });

      captureWin.webContents.on('did-finish-load', async () => {
        try {
          this.log('CAM', 'Target Acquired. Capturing Assets...');

          // 1. Get HTML
          const html = await captureWin.webContents.executeJavaScript('document.documentElement.outerHTML');
          this.log('CAM', `HTML Snapshot Secured (${html.length} bytes).`);

          // 2. Take Screenshot
          const image = await captureWin.webContents.capturePage();
          const png = image.toPNG();
          const filename = `thor-snap-${Date.now()}.png`;
          const userDataPath = app.getPath('userData');
          const savePath = path.join(userDataPath, 'thor-assets', filename);

          await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
          await fs.promises.writeFile(savePath, png);

          this.log('CAM', `Visual Intel Saved to ${filename}`);

          clearTimeout(timeout);
          captureWin.destroy();
          resolve({ html, screenshotPath: savePath });

        } catch (err: any) {
          clearTimeout(timeout);
          if (!captureWin.isDestroyed()) captureWin.destroy();
          reject(err);
        }
      });
    });
  }

  private async runLeo(html: string, handCards: HandCardLite[]): Promise<LeoAnalysis> {
    this.log('LEO', '🐕 Analyzing Target Data Structure...');

    // Clean HTML for token efficiency
    const cleanHtml = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
      .slice(0, 40000);

    // Build rich hand context for Leo to analyze
    const handContext = handCards.length > 0
      ? handCards.map(c => ({
        id: c.cardId,
        name: c.name || 'Unknown',
        lore: c.lore || '',
        skills: c.skills?.map(s => s.name) || [],
        desires: c.desires || '',
      }))
      : [];

    const prompt = `
You are "Leo" 🐕, the Scout and Context Weaver.

YOUR MISSION:
1. Deeply analyze the URL content below
2. Study the user's current Hand cards 
3. Find connections between the URL content and the Hand
4. Guide Thor on what to prioritize when forging new cards

=== URL CONTENT ===
${cleanHtml}

=== USER'S HAND (Current Arsenal) ===
${JSON.stringify(handContext, null, 2)}

=== ANALYSIS TASKS ===
1. IDENTITY: What IS this URL? (Tool, Service, Knowledge Base, Platform, etc.)
2. CORE VALUE: What's the most valuable thing here?
3. LOOT EXTRACTION: What specific skills/concepts can we capture as cards?
4. HAND SYNERGIES: Which Hand cards connect to this content? What skills from Hand cards are relevant?
5. FORGING PRIORITY: Based on the Hand context, what should Thor focus on when creating cards?

OUTPUT (JSON):
{
  "title": "Page title or name",
  "summary": "2-3 sentence summary of what this source offers",
  "category": "Tool | Platform | Knowledge | Service | Resource",
  "core_value": "The single most valuable aspect of this source",
  "loot_potential": [
    {
      "concept": "Name of extractable concept/skill",
      "why_valuable": "Why this matters to the user",
      "use_case": "Practical application"
    }
  ],
  "target_audience": "Who this is designed for",
  "related_domains": ["Domain1", "Domain2"],
  "hand_synergies": [
    {
      "hand_card_id": "ID of relevant hand card",
      "hand_card_name": "Name of the hand card",
      "relevant_skills": ["Skills from that card that connect"],
      "connection": "How this URL content relates to that card"
    }
  ],
  "forging_priority": "Guidance for Thor: what to emphasize based on Hand context"
}
    `;

    const result = await this.callAI(prompt, 'LEO', 'smart-llm') as LeoAnalysis;

    const synergyCount = result.hand_synergies?.length || 0;
    this.log('LEO', `🐕 Analysis Complete: "${result.title || 'Unknown'}" | ${synergyCount} Hand synergies found`);

    return result;
  }

  private async runThor(leoContext: LeoAnalysis, handCards: HandCardLite[]): Promise<{ setData: any, cardDataList: any[], siblingLinks: Array<{ newCardSkill: string, handCardId: string }> }> {
    this.log('THOR', '🐱 Forging Connection...');

    const prompt = `
You are "Thor" 🐈, the Forge Master.

You transform raw intelligence into powerful, fully-realized Cards for the user's arsenal.

=== LEO'S INTEL ===
${JSON.stringify(leoContext, null, 2)}

=== FORGING RULES ===
1. Each card must be ACTIONABLE - something the user can DO with it
2. Lore should be evocative (2-3 sentences) AND hint at practical use
3. Extract ALL reasonable skills - no arbitrary limits. Each skill needs a name, description, and type
4. Truths are FACTS about the concept, not opinions (2-4 per card)
5. Desires explain what the card "wants to do" - its purpose
6. howToUse gives practical step-by-step guidance
7. If Leo identified hand synergies, note them in synergies array with the hand card IDs
8. linkedHandCards should list hand card IDs that this new card's skills relate to

=== FORGING PRIORITY (from Leo) ===
${leoContext.forging_priority || 'No specific priority - forge freely'}

=== HAND SYNERGIES (from Leo) ===
${JSON.stringify(leoContext.hand_synergies || [], null, 2)}

=== CREATE ===
- 1 SET CARD (portal representing the source)
- 3-6 LOOT CARDS (concepts/tools extracted from the source)

OUTPUT (JSON):
{
  "set_card": {
    "name": "Evocative portal name",
    "subtitle": "What this source is",
    "type": "Portal",
    "tier": 2,
    "lore": "2-3 evocative sentences about this portal/source",
    "truths": ["Factual statement 1", "Factual statement 2"],
    "desires": "What exploring this source enables the user to do"
  },
  "cards": [
    {
      "name": "Card Name",
      "subtitle": "Brief descriptor (e.g. 'AI Music Generator')",
      "type": "Tool | Technique | Concept | Entity | Principle",
      "tier": 1,
      "lore": "2-3 evocative sentences that hint at practical value",
      "skills": [
        {
          "name": "Skill Name",
          "description": "What this skill does, practically (1-2 sentences)",
          "type": "Active | Passive | Triggered"
        }
      ],
      "truths": ["Factual statement 1", "Factual statement 2"],
      "desires": "What this card wants to help you accomplish",
      "howToUse": "Practical step-by-step guidance on applying this",
      "synergies": ["Hand card name if relevant"],
      "linkedHandCards": ["hand-card-id-if-skills-relate"],
      "extractedFrom": "Which part of source this came from"
    }
  ]
}
    `;

    const result = await this.callAI(prompt, 'THOR', 'smart-llm');

    // Extract sibling links from cards
    const siblingLinks: Array<{ newCardSkill: string, handCardId: string }> = [];
    if (result.cards) {
      for (const card of result.cards) {
        if (card.linkedHandCards && card.skills) {
          for (const handCardId of card.linkedHandCards) {
            for (const skill of card.skills) {
              siblingLinks.push({ newCardSkill: skill.name, handCardId });
            }
          }
        }
      }
    }

    const skillCount = result.cards?.reduce((acc: number, c: any) => acc + (c.skills?.length || 0), 0) || 0;
    this.log('THOR', `🐱 Synthesis Complete: ${result.cards?.length || 0} cards, ${skillCount} skills, ${siblingLinks.length} sibling links`);

    return { setData: result.set_card, cardDataList: result.cards, siblingLinks };
  }

  private async callAI(prompt: string, agent: 'LEO' | 'THOR', modelType: 'fast-llm' | 'smart-llm'): Promise<any> {
    // Priority: AIMLAPI -> Vertex AI -> Google AI Studio
    const useAimlApi = isAimlApiConfigured();
    const useVertex = !useAimlApi && isVertexAIConfigured();

    let text = '';

    // PRIORITY 1: AIMLAPI.com
    if (useAimlApi) {
      const aimlClient = new AimlApiClient();
      const aimlModelId = AIMLAPI_MODEL_MAP[modelType];
      const result = await aimlClient.chatCompletion(
        [{ role: 'user', content: prompt }],
        aimlModelId,
        { temperature: 0.7, max_tokens: 4000 }
      );
      text = result.content;
    }
    // PRIORITY 2: Vertex AI
    else if (useVertex) {
      const client = getVertexAIClient();
      const result = await client.generateContent(prompt, modelType, { responseMimeType: 'application/json' });
      text = result.text;
    }
    // PRIORITY 3: Google AI Studio
    else {
      const apiKey = store.get('geminiKey');
      if (!apiKey) throw new Error("No AI Key Configured. Set up AIMLAPI.com, Vertex AI, or Google AI Studio.");

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = modelType === 'smart-llm' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: 'application/json' } });
      const result = await model.generateContent(prompt);
      text = result.response.text();
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      this.log('ERR', `AI JSON Parse Failed: ${text.slice(0, 100)}...`);
      throw new Error("AI Output Malformed");
    }
  }

  private async fabricateAssets(
    url: string,
    screenshotPath: string,
    setData: any,
    cardDataList: any[],
    siblingLinks: Array<{ newCardSkill: string, handCardId: string }>
  ) {
    this.log('THOR', '🐱 Minting Artifacts to Hypercore...');

    const timestamp = Date.now();
    const setCardId = `thor-set-${timestamp}`;
    const childCardIds: string[] = [];
    const cardIdMap: Map<string, string> = new Map(); // card name -> cardId for sibling linking

    // Ensure card-library core exists
    await createCore(CARD_LIBRARY_CORE_NAME);

    // 1. Create Child Cards first
    for (let i = 0; i < cardDataList.length; i++) {
      const data = cardDataList[i];
      const cardId = `thor-card-${timestamp}-${i}`;
      cardIdMap.set(data.name, cardId);

      // Create card data core with full schema
      await createCore(cardId);
      const cardRecord = {
        type: 'card-data',
        cardId,
        name: data.name,
        subtitle: data.subtitle || '',
        cardType: data.type || 'Concept',
        tier: data.tier || 1,
        lore: data.lore || '',
        skills: data.skills || [],
        truths: data.truths || [],
        desires: data.desires || '',
        howToUse: data.howToUse || '',
        synergies: data.synergies || [],
        linkedHandCards: data.linkedHandCards || [],
        extractedFrom: data.extractedFrom || '',
        createdAt: new Date().toISOString(),
        sourceUrl: url,
      };
      await appendToCore(cardId, JSON.stringify(cardRecord));

      // Add to library index with enriched data
      const libraryEntry = {
        type: 'card-index',
        cardId,
        cardType: 'standard',
        name: data.name,
        lore: data.lore,
        tier: data.tier || 1,
        parentCardId: setCardId,
        memberOfSets: [{ setCardId, joinedAt: new Date().toISOString(), addedBy: 'thor' }],
        thumbnail: screenshotPath,
        createdAt: new Date().toISOString(),
        tags: ['thor-forged', 'external-source'],
        // Store skills, truths, desires in metadata for HandCardView
        metadata: {
          skills: data.skills || [],
          truths: data.truths || [],
          desires: data.desires || '',
          howToUse: data.howToUse || '',
          synergies: data.synergies || [],
          linkedHandCards: data.linkedHandCards || [],
        },
      };
      await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));

      // Emit to persistence
      emitCardEvent('CARD_CREATED', libraryEntry);

      childCardIds.push(cardId);
      this.log('THOR', `🐱 Forged: ${data.name} (${data.skills?.length || 0} skills)`);
    }

    // 2. Create sibling link records for skills
    if (siblingLinks.length > 0) {
      this.log('THOR', `🐱 Linking ${siblingLinks.length} skill synergies to hand cards...`);
      for (const link of siblingLinks) {
        const siblingRecord = {
          type: 'sibling-link',
          skillName: link.newCardSkill,
          sourceCardId: link.handCardId,
          linkedAt: new Date().toISOString(),
          linkType: 'skill-synergy',
        };
        await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(siblingRecord));
      }
    }

    // 3. Create Set Card with enriched data
    await createCore(setCardId);
    const setRecord = {
      type: 'card-data',
      cardId: setCardId,
      name: setData.name,
      subtitle: setData.subtitle || '',
      cardType: 'Portal',
      tier: setData.tier || 2,
      lore: setData.lore || '',
      truths: setData.truths || [],
      desires: setData.desires || '',
      sourceUrl: url,
      iframeMode: true,
      children: childCardIds,
      createdAt: new Date().toISOString(),
    };
    await appendToCore(setCardId, JSON.stringify(setRecord));

    // Add set to library index
    const setLibraryEntry = {
      type: 'card-index',
      cardId: setCardId,
      cardType: 'set',
      name: setData.name,
      lore: setData.lore,
      tier: setData.tier || 2,
      thumbnail: screenshotPath,
      children: childCardIds,
      createdAt: new Date().toISOString(),
      tags: ['thor-set', 'external-source'],
      metadata: {
        url,
        iframeMode: true,
        truths: setData.truths || [],
        desires: setData.desires || '',
      },
    };
    await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(setLibraryEntry));

    // Emit set to persistence
    emitCardEvent('CARD_CREATED', setLibraryEntry);

    const totalSkills = cardDataList.reduce((acc, c) => acc + (c.skills?.length || 0), 0);
    this.log('SYS', `✨ Set "${setData.name}" Finalized: ${childCardIds.length} cards, ${totalSkills} skills, ${siblingLinks.length} synergies`);

    // Return forge result for frontend display
    return {
      setCard: {
        cardId: setCardId,
        name: setData.name || 'Unnamed Set',
        subtitle: setData.subtitle || '',
        lore: setData.lore || '',
        tier: setData.tier || 2,
        thumbnail: screenshotPath,
        truths: setData.truths || [],
        desires: setData.desires || '',
      },
      childCards: cardDataList.map((data, i) => ({
        cardId: childCardIds[i],
        name: data.name || 'Unnamed Card',
        subtitle: data.subtitle || '',
        lore: data.lore || '',
        tier: data.tier || 1,
        thumbnail: screenshotPath,
        skills: data.skills || [],
        truths: data.truths || [],
        desires: data.desires || '',
        synergies: data.synergies || [],
        howToUse: data.howToUse || '',
      })),
      stats: {
        totalCards: childCardIds.length,
        totalSkills,
        totalSynergies: siblingLinks.length,
      },
      sourceUrl: url,
    };
  }
}

export const thorsHammaManager = new ThorsHammaManager();
