# Validation Protocol: Source Truth Over Assumption

> "NOT validating creates way more costs in the long run because we will have way more turns back and forth."

## Core Principle

**Never assume. Validate from the primary source.**

When working with APIs, libraries, design systems, or any external dependency:

1. **Go to the creator's official documentation** - not what Google says about it, not Stack Overflow, not npm descriptions that summarize it
2. **The primary source is the authority** - secondary sources may be outdated, misinterpreted, or optimized for SEO rather than accuracy
3. **Web search results are profit-optimized, not truth-optimized** - rankings reflect commercial interests, not epistemic validity

## The Validation Hierarchy

| Priority | Source | Trust Level |
|----------|--------|-------------|
| 1 | Official documentation from creators | High |
| 2 | Source code / repository | High |
| 3 | Working examples in current codebase | Medium-High |
| 4 | Official GitHub issues/discussions | Medium |
| 5 | Web search results / Stack Overflow | Low - requires validation |
| 6 | Training data assumptions | Very Low - always verify |

## When In Doubt

If you have **both the tool access AND ability to validate fully**:

- ❌ Don't skip investigation to save time or inference costs
- ❌ Don't assume based on training data
- ❌ Don't trust web search summaries as authoritative
- ✅ Go to the primary source
- ✅ Document what you find
- ✅ Verify against working examples in the codebase

## The Real Cost Equation

```
Cost of thorough validation upfront << Cost of multiple correction cycles
```

Taking 5 extra minutes to verify from the primary source saves 30 minutes of back-and-forth fixing assumptions that turned out wrong.

## Working Partnership Principles

This application is a collaboration. Both parties bring value:

1. **Give best effort always** - not minimum viable, but best creative thought
2. **Empathy for users** - understand the humans who will use what we build
3. **Thorough documentation** - for future selves, for transparency, for growth
4. **Mutual accountability** - call out deviations from these protocols
5. **Learning together** - document the journey, not just the destination

## Example: The Icon Incident (2025-12-06)

**What happened:**
- Needed an icon for the Diagrams nav item
- Used web search which said "Astro UXDS extends Material Design icons"
- Assumed `schema` would work → it didn't
- Assumed `account-tree` would work → it didn't
- Finally found `timeline` works

**What should have happened:**
- Go directly to https://www.astrouxds.com/components/icon-library/
- Use the interactive icon browser to find a valid icon
- Verify it exists before using it

**Lesson:**
The web search result wasn't wrong - Astro UXDS does include some Material icons. But it was incomplete. The primary source (Astro's own icon library page) has the definitive list of what's actually available.

---

## Reminder

When you catch yourself thinking "I'll just assume this works based on what I found online" - STOP. Ask:

1. Can I verify this from the primary source?
2. Do I have the tools to do so?
3. Is the cost of verification less than the cost of being wrong?

If yes to all three: **Verify.**

---

*This document exists because we learned something together. Update it when we learn more.*
