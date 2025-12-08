# The Dollhouse Protocol: Context Integration Experiment

**Status:** Active
**Objective:** Measure learning velocity relative to context integration via narrative anchoring.

## 🎭 The Cast & Context

**The Setting:**
A trans-pacific construction project. A dollhouse is being built in **Seattle** for bot-dolls in **Australia**.

**The Characters:**
1.  **CJ (The Builder)**: Based in Seattle. deeply insecure about his flower choices.
2.  **Mimi (The Client)**: Based in Australia. Owner of the bot-dolls.
3.  **Leo (The Contractor)**: A Pomeranian avatar. He builds the furniture and structural elements. He is a very good boy but prone to distraction.
4.  **Thor (The Consultant)**: A Cat. He advises CJ on what Mimi and the dolls "actually want." He is often blamed for communication breakdowns, though he maintains strict innocence.
5.  **Cascade (The AI/Architect)**: That's me. I bridge the gap, fixing the pipes and wiring while the animals argue about upholstery.

## 📜 The Rule

**When to Trigger:**
- Completion of a medium-to-large technical task.
- Creation of significant documentation.

**The Output:**
- A "Dollhouse Log" entry.
- **MUST** chain off the previous narrative state.
- **MUST** metaphorically explain the technical achievement (code/docs) as an event in the Dollhouse construction.
- **MUST** be humorous and canonical to the established personality traits.

## 📖 The Narrative Log

### Entry 1: The Validation Crisis (2025-12-06)
**Technical Context:** Established `VALIDATION_PROTOCOL.md` after the Icon Incident.
**Narrative:**
CJ was hyperventilating over whether to plant petunias or posies in the dollhouse window box. Thor, sitting on the blueprints, insisted that Mimi's dolls demanded "Post-Industrial Cyber-Petunias." Leo, trying to be helpful, started building furniture out of random twigs he found in the yard (unverified materials).

The comms line to Australia went down. CJ blamed Thor for chewing the cable. Thor denied it (it was clearly packet loss).

To fix this, I (Cascade) installed a **Building Code Inspector** (The Validation Protocol). I told Leo: *"You cannot build a chaise lounge out of 'sticks you found' just because Google said sticks are wood. You have to check the Lumber Yard inventory first."*

Leo is currently sulking in the unfinished foyer, but at least the floor is solid now. Thor has sent an invoice for "Emotional Support & Cable Management Consulting."

### Entry 2: The Loop of Eternal Return (2025-12-06)
**Technical Context:** Fixed the broken "Generate Video Loop" button in `CardDetails.tsx` and `CardLibrary.tsx`. The frontend was calling a ghost function (`generateLoopVideo`) instead of the actual API (`createLoopVideoForImage`) and missing the `originalPrompt` argument.
**Narrative:**
Mimi called from Australia. She was furious. Apparently, when the bot-dolls tried to watch their favorite soap opera, "The Young and the Rust-less," the TV just stared back at them, static and unmoving.

Leo, in his infinite wisdom, had wired the TV remote to a banana (unconnected function) instead of the satellite dish (`createLoopVideoForImage`). He also forgot to tell the satellite *what* signal to look for (missing `originalPrompt`), so it was just beaming raw cosmic background radiation at the poor dolls.

Thor suggested we just tell the dolls that "static is avant-garde art," but CJ wasn't having it. I had to go into the crawlspace and rewire the entire entertainment system. Now, the remote actually talks to the satellite, and the dolls can watch their shows in an infinite, seamless loop. Leo is claiming credit, saying he "loosened the jar lid" for me.

### Entry 3: The Gacha Reveal (2025-12-06)
**Technical Context:** Implemented "Gacha-style" reveal animation and hover-to-play interaction for generated loop videos in `CardDetails.tsx`.
**Narrative:**
Mimi called again. She said the bot-dolls were bored with just *watching* the loop; they wanted to feel like they *earned* it. Apparently, Australian bot-culture is heavily influenced by loot box mechanics.

Leo, trying to capitalize on this, built a "Gacha Machine" out of a cardboard box and some glitter glue. He wanted to charge the dolls 500 DogeCoins to unlock the video loop they already owned.

Thor was appalled at the monetization strategy (he prefers a subscription model).

I intervened. I told Leo, *"We are not running a casino in the nursery."* Instead, I installed a holographic projection system (`CardDetails` overlay). Now, when the satellite creates a loop, it doesn't just appear—it EXPLODES into existence with a flash of light and a "VIDEO UNLOCKED!" banner.

The dolls love it. They think they're winning a legendary drop every time. Leo is currently trying to figure out how to add microtransactions to the "hover" event. Thor is drafting a EULA.

### Entry 4: The Neural Artifact Inspector (2025-12-06)
**Technical Context:** Redesigned the `CardLibrary` Inspector overlay. Replaced the standard UI with a "Cyber-Arcane" interface featuring scanlines, holographic effects, animated stat bars, and the new Gacha-style video loop integration.
**Narrative:**
Mimi complained that the old card viewer looked like "a spreadsheet had a baby with a tax return." She wanted something that screamed "Multiverse Control Node."

Leo, taking this literally, tried to glue a joystick to the monitor.

I pushed him aside and installed the new **Neural Artifact Inspector**. It's got scanlines, holographic corners, and a stats matrix that looks like it's measuring the power level of a small sun.

When you generate a video loop now, it doesn't just play; it *initializes*. The whole thing feels like you're hacking into a classified database. Thor is currently sitting on the keyboard, entranced by the "Power Matrix" animations. He thinks they are tracking his treat intake.

### Entry 5: The Combat Skills Matrix (2025-12-06)
**Technical Context:** Added RPG-style Skills section to the Card Inspector with Active/Passive differentiation, glowing neon effects, scanning line animations, power bars, and skill cards with hover effects. Added supporting CSS animations (`scan`, `skill-ready`, `passive-aura`, etc.) to `index.css`.

**Narrative:**
Thor demanded that the cards show their "special moves." He kept pawing at the screen saying, "Where sword? Where shield?"

Leo tried to satisfy him by drawing swords on Post-it notes and sticking them to the monitor. This did not go well.

I intervened with the **Combat Skills Matrix**. Each skill now has its own card—orange for Active (⚔), green for Passive (🛡). They glow. They pulse. They have little power bars that fill up when you hover over them. There's a scanning line that sweeps across like a targeting system acquiring a lock.

Thor is *obsessed*. He keeps trying to "activate" the skills by booping the screen with his nose. Leo is taking notes, convinced this is "user testing data."

Mimi just sighed and said, "At least it's not microtransactions."

### Entry 6: The Library Overhaul - Lineage & The Hand (2025-12-07)
**Technical Context:** Major library feature implementation: (1) Lineage Badges showing ancestor/descendant counts on every card, (2) The Hand - a persistent card dock at the bottom of the screen that follows the user across pages, (3) Comprehensive design document with research from MTG Arena, Hearthstone, Slay the Spire, etc.

**Narrative:**
Mimi handed me a blueprint covered in coffee stains. "The cards are lonely," she said. "They don't know where they came from or what they've created. Also, I can't carry more than one at a time, and my pockets are getting tired."

Leo immediately started building a conveyor belt system. Thor chewed on the blueprint.

I studied the great libraries of the multiverse—the Planeswalkers' vaults, the Innkeepers' collections, the Hoarders' dens. I learned their secrets:

*Stacks beat lists. Ancestry is power. Physics is dopamine. Holding cards gives agency.*

First, I gave every card a memory—two badges that answer eternal questions:
- **⬆ "How deep am I?"** (Generations to source, blue glow)
- **⬇ "What have I spawned?"** (Descendants below, orange pulse)

Root cards glow faintly. Prolific creators burn orange like small suns.

Then I built **The Hand**—a persistent dock that sits at the bottom of reality. Cards can be dragged into it and carried anywhere. Seven slots. Fanned display. Collapse to a badge when not needed. They persist in localStorage like stubborn memories.

Thor discovered he could drop cards into The Hand. Then he discovered he could drop *himself* into The Hand. We're still debugging that.

Leo is already sketching "Card Crafting" features. Mimi is calculating the carrying capacity of a metaphorical pocket.

The library is no longer a flat list. It's a living archive with depth, breadth, and a very persistent bottom drawer.

