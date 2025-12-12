---
description: Comprehensive plan for the "Flow Forger" features - an interactive, visual pipeline editor and monitor.
---

# 🌊 Flow Forger: Visual Pipeline Architecture

## 1. Vision & Objective
To transform the current static pipeline execution into a **fully observable, interactive, and "living" visual interface**. This feature will bridge the gap between "code" and "execution," allowing users to see exactly *how* their data is being transformed, *where* it is going, and *who* (which Agent/Pet) is handling it.

**Core Philosophy:** "The Map IS the Territory." The visual diagram shouldn't just *show* what's happening; it should be the primary way to *control* what happens.

## 2. Technology Stack & Foundation
While the current "Diagrams" page uses Mermaid.js, to achieve the requested level of interactivity ("manipulate pipelines," "pets carrying cards"), we must upgrade to a more robust node-based engine.

*   **Core Engine:** `React Flow` (or `@xyflow/react`).
    *   *Why?* Supports custom node components (HTML/React inside nodes), full drag-and-drop, zoom/pan, and custom edge animations (essential for "pets carrying cards"). Mermaid is too static for direct manipulation.
*   **State Management:** `Zustand` (already in use). We will create a `PipelineStore` to sync the visual graph with the backend `PipelineManager`.
*   **Styling:** Tailwind CSS with a "Glassmorphic" + "Cyber-Organic" aesthetic (matching the Hell Week "dark/neon" vibe).

## 3. The "Flow Surface" UI Design
The interface, dubbed **"The Flow Surface,"** is an infinite canvas.

### A. The Nodes (Process Stations)
Each step in the pipeline (e.g., "Leo Analysis", "Thor Forge") is represented by a **Feature-Rich Node Card**:
*   **Visuals**: Glass-panel background with a neon border color-coded to the agent (Leo=Pink, Thor=Cyan, Conviction=Amber).
*   **Agent Perch**: A dedicated graphical slot on top of the node where the relevant "Pet" avatar sits.
    *   *Idle*: Pet is sleeping or looking around.
    *   *Active*: Pet is typing, hammering (Thor), or scanning (Leo).
*   **IO Indicators**: Visible input/output sockets showing data types (e.g., `Text Blob` -> `JSON`).
*   **Model Badge**: Shows current model (e.g., "Gemini 1.5 Pro"). Click to quick-swap models.

### B. The Edges (Data Veins)
*   **Dynamic Flow**: Connections aren't just lines; they are animated "veins."
*   **Payload Animation (The "Pet Carrier")**:
    *   When data moves from one node to another, a **mini-avatar (Pet)** appears carrying a "Card" or "Cube" along the wire.
    *   *Example*: After Leo finishes, a mini-Leo grabs the JSON packet and runs along the wire to hand it to Thor.

### C. The Inspector (Deep Dive Panel)
Clicking any node opens the "Schematic Inspector" (Slide-over panel):
1.  **Prompts**: View the raw prompt template. *Future*: Edit the prompt template in real-time.
2.  **Schema**: Visual JSON tree of the expected Input/Output structure.
3.  **Live Pulse**: See the actual data flowing through right now (streaming text/JSON).
4.  **Cost/Stats**: Token usage and latency for this specific step.

## 4. Features & Roadmap

### Phase 1: "The Observable Pipeline" (Read-Only Monitor)
*Objective: Visualize the current hardcoded pipeline in real-time.*
1.  **Pipeline Map**: Implement `React Flow` graph mirroring the `PipelinePhase` statuses.
2.  **Live State Sync**: Connect `onPipelineUpdate` IPC events to the graph. Nodes light up when active.
3.  **Inspector integration**: Show static prompt templates from `thors-hamma.ts` when nodes are clicked.
4.  **Mini-Pet Animations**: Basic CSS animation of dots/icons moving between nodes on completion.

### Phase 2: "The Tactile Controller" (Interactivity)
*Objective: Allow control via the visualizer.*
1.  **Model Swapping**: Dropdown on the Node UI to switch between "Fast" and "Smart" models.
2.  **Play/Pause/Step**: Add controls to "Pause" the pipeline at a specific node (e.g., "Pause before Minting") to inspect data.
3.  **Prompt Twealing**: "Edit Prompt" button in Inspector allows "hot-patching" the prompt for the current run.

### Phase 3: "The Architect" (Builder)
*Objective: Drag-and-drop pipeline construction.*
1.  **Tool palette**: Drag new "Generic Agent" nodes onto the canvas.
2.  **Wiring**: Drag cables between nodes to define data flow.
3.  **Pipeline Persist**: Save custom graph configurations to `.json` files.

## 5. Implementation Details: "The Pet Layer"
To satisfy the requirement of "Pets carrying cards," we will implement a custom `Edge` component in React Flow.

```typescript
// Concept for PetCarryingEdge.tsx
const PetCarryingEdge = ({ sourceX, sourceY, targetX, targetY, data }) => {
  // SVG path for the wire
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  
  return (
    <>
      <BaseEdge path={edgePath} />
      {data.isTransferring && (
         <foreignObject>
            {/* Animated Pet Element following the path offset */}
            <motion.div animate={{ offsetDistance: "100%" }}>
               <ChibiThor carrying="Card" />
            </motion.div>
         </foreignObject>
      )}
    </>
  );
};
```

## 6. Schema Visualization Strategy
For "Click-to-see schemas," we will parse the TypeScript interface definitions (AST) or use Zod schemas if available. 
*   **Visualizer**: Use `react-json-view` for data and a custom tree visualizer for structure.
*   **Diff View**: Improve the Inspector to show "Input vs Output" side-by-side to visualize the transformation.

## 7. Next Steps for "Cultivation"
1.  **Scaffold**: Install `reactflow` (`npm install reactflow`).
2.  **Prototype**: Create `src/pages/FlowForger.tsx`.
3.  **Map**: Hardcode the initial nodes for [Leo] -> [Thor] -> [Media] -> [Conviction].
4.  **Animate**: getting the "Pet Carrier" animation working is the aesthetic priority.
