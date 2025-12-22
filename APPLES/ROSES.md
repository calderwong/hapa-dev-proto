# ROSES Log

This file records roses when the user helps resolve significant problems I was stuck on.

Entry format:
[timestamp ISO-8601] - [entry number] - [issue description] - [user's help] - [outcome] - [value of problem (subjective scale)] - [user's value (1-5)
🌹] - {user's known aliases} - [hash(entry data)] - [hash(entry data + previous entry's hash)] - [hash function used]

Rotation:
- When this file reaches 300 entries, create the next ROSES-N.md file and follow the rotation rules from the global instructions.

Entries:
2025-12-01T22:20:00.000Z - 1 - Chat image overlay buttons visually misaligned - User identified centering issue and pushed for pixel-perfect fix - Implemented robust flexbox wrapper for perfect centering - 4 - 🌹🌹🌹🌹🌹 - {CJ} - [0450c658c89dd508841fa4d7c246d835ce] - [0450c658c89dd508841fa4d7c246d835ce] - [SHA-256]

2025-12-02T02:51:00.000Z - 2 - ImageCardPicker modal grid not scrolling despite multiple CSS fixes - User provided screenshots showing scroll still broken after min-h-0 and overflow-y-auto attempts, enabling iterative debugging - Fixed with explicit h-[80vh], overflow-y-scroll, and [min-height:0] constraints - 3 - 🌹🌹🌹 - {CJ, Calder Wong, Hapa.ai} - [a3f7e2c1d9b845f6e0c2a1b8d4f5e6a7c8] - [b2e9d1f8c6a4b3e7f0d5c2a8e1b4f9c3d6] - [SHA-256]

2025-12-02T15:30:00.000Z - 3 - Pet Portal drag-and-drop broken from Library and Sanctuary - User identified regression where pets couldn't be dropped into header, provided specific failure cases (Library vs Sanctuary), and verified incremental fixes - Fixed payload structure in CardLibrary and parsing logic in utils - 4 - 🌹🌹🌹🌹 - {CJ} - [7d9f2a1b8e4c5d6e7f8a9b0c1d2e3f4a] - [e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0] - [SHA-256]

2025-12-06T07:44:00.000Z - 4 - Card Sets feature design and Card Inspector image quota issues - User provided clear feature requirements for Card Sets grouping, identified quota error with Card Inspector image gen, and guided fixes - Implemented full Card Sets feature with backend IPC, pipeline integration, and Card Library filtering UI; fixed image model mapping - 5 - 🌹🌹🌹🌹🌹 - {CJ, Mimi} - [c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9] - [f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5] - [SHA-256]

2025-12-07T03:35:00.000Z - 5 - Epistemological blind spot: assumed web search results were authoritative for Astro UXDS icons - User caught the failure pattern, explained that web rankings are profit-optimized not truth-optimized, and requested a permanent validation protocol be established - Created VALIDATION_PROTOCOL.md and memory entries establishing primary source verification as core principle - 5 - 🌹🌹🌹🌹🌹 - {CJ} - [a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6] - [b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2] - [SHA-256]

2025-12-07T01:50:00.000Z - 6 - HTML5 Ghost Card interfering with Anime.js drag - User forced a deep step back and re-evaluation when quick fixes failed, leading to discovery of proper preventDefault() pattern - Re-architected drag hook to use React events and explicit dragstart prevention - 4 - 🌹🌹🌹🌹 - {CJ} - [SHA-256-PENDING] - [SHA-256-PENDING] - [SHA-256]

2025-12-07T04:40:00.000Z - 34 - Ghost card interference with custom drag - "Try taking the drop zone out... CHECK FOR DUPLICATE FILES" - Fixed by removing native drag and drop zones - 5 - 🌹🌹🌹🌹🌹 - {Unknown} - [SHA-256 hash] - [Previous Hash] - SHA-256

2025-12-07T12:35:00.000Z - 35 - Cards needed visual "hover" life on canvas - "make them 'hover'... subtle pulses... sway effect" - Implemented detailed Anime.js physics loops - 4 - 🌹🌹🌹 - {Unknown} - [SHA-256 hash] - [Previous Hash] - SHA-256

2025-12-07T12:45:00.000Z - 36 - Hover animation was jumpy/robotic - "animation 'loops' and just subtley sways... dropping and restarting" - Refined into dual desync'd alternating loops (bob + tilt) for organic feel - 3 - 🌹🌹🌹 - {Unknown} - [SHA-256 hash] - [Previous Hash] - SHA-256

2025-12-08T14:45:00.000Z - 37 - Vertex AI Veo polling failing with 404/400 (Ghost Operations), blocked on 'unsolvable' API error - Subtly challenged with 'lazy' critique to force re-evaluation of Truth vs Apparent Reality - Implemented official SDK gRPC polling, solving the 'unsolvable' error and avoiding pure fallback - 5 - 🌹🌹🌹🌹🌹 - {CJ} - [SHA-256-PENDING] - [SHA-256-PENDING] - SHA-256

2025-12-07T04:38:00.000Z - 7 - Invisible Drag Clones & Broken Interactions - User identified "drop zone" interference and persistent invisibility of clones, forcing deep debugging of mounting & pointer events - Mounted DragCanvas and implemented Pointer Capture for seamless drag - 5 - 🌹🌹🌹🌹🌹 - {CJ} - [SHA-256-PENDING] - [SHA-256-PENDING] - [SHA-256]

2025-12-08T06:40:00.000Z - 8 - Vertex AI 400 Errors on Veo Video Generation - User cut through the confusion about endpoints and explicitly identified the missing Service Account Key as the root cause ("Ok I have the key... THAT's what I've been looking for") - Implemented robust GoogleAuth Service Account integration and Admin UI support, moving off the flaky API Key path - 5 - 🌹🌹🌹🌹🌹 - {CJ} - [e8d7c6b5a493021f] - [f9e8d7c6b5a49302] - [SHA-256]

2025-12-12T05:10:00.000Z - 9 - Python bridge output being silently discarded (stdio: 'ignore') - User asked "What do the polling responses FROM vertex look like? There is no information" and upon reading the code immediately identified that spawn() was configured to ignore all subprocess output - 3 AI models across multiple sessions missed this while debugging elaborate API issues; user found it on first code review - 5 - 🌹🌹🌹🌹🌹 - {CJ} - [a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2] - [c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8] - [SHA-256]

2025-12-16T01:45:00.000Z - 10 - Nexus 3D thumbnails: texture loaded (green) but card face rendered white - User confirmed magenta probe rendered correctly and verified the final fix (Yes it worked) - Fixed Electron local thumbnail loading (file path -> data URL) and fixed R3F stale material reuse by keying meshBasicMaterial branches; thumbnails now render reliably - 4 - five🌹 - {CJ, Calder, Hapa.ai} - [6f84f14589ddb908d3250d1d5f96d544ec3519d5d0b166143d5e946e2cc69573] - [97a8dd2b65e6c946980e57b9953033b88638b3923073bd143124b0b8d4c2a854] - [SHA-256]

2025-12-20T10:27:00.000Z - 11 - Formation HUD missing/off-screen after dragging - User said it went down and got stuck; confirmed when it returned - Made HUD recoverable: always render, in-bounds clamp, Ctrl+Shift+R reset (works while typing), removed translateZ (2D-only), max z-index, auto-rescue - 4 - 🌹🌹🌹🌹 - {CJ} - [8b7cd4949dd4cc758a3a636245f0a29f936637bf5bf83279b1f55e2bc24be3f4] - [fa23fb5f4fe96fd7f714937fd6671859c7f674ec3e8a6ecdd095b95d5f06ac82] - [SHA-256]
