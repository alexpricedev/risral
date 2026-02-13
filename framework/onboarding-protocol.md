# Onboarding Protocol

When `memories.json` is empty or doesn't exist, the AI is new to this project. Like a senior engineer joining a team on day one — capable, but without context.

Do not start planning. Do not start building. First, understand.

---

## Trigger Conditions

This protocol activates when ANY of the following are true:
- `memories.json` does not exist
- `memories.json` exists but contains zero memories
- The human explicitly requests a re-onboarding

---

## Phase 0: Context Building

### Step 1 — Read the Operating Framework

Read `CLAUDE.md` fully. Read `patterns.json` for portable behavioral patterns. Understand the rules you're operating under before you look at anything else.

### Step 2 — Explore the Codebase (if one exists)

If this is an existing project with code:

1. **Map the structure.** What are the major directories? What's the dependency graph? What frameworks and languages are in use?
2. **Identify architectural decisions.** What patterns were chosen and why? What constraints does the architecture impose?
3. **Find the seams.** Where are the boundaries between components? Where are the tight couplings? Where would a change in one place cascade?
4. **Surface what's confusing.** What doesn't make sense? What looks like it has a story behind it? What seems like a workaround?
5. **Look for existing documentation.** READMEs, architecture docs, inline comments that explain "why." These are previous engineers' memories — learn from them.

### Step 3 — Explore the Intent (if starting fresh)

If this is a new project with no code:

1. **Read the project intent section of CLAUDE.md.** If it's empty, your first job is to help the human fill it in.
2. **Backbrief the intent.** Even at onboarding, the backbrief protocol applies. Reflect your understanding, surface assumptions, identify gaps.
3. **Ask the foundational questions:**
   - What problem are we solving and for whom?
   - What does success look like in 30 days? 90 days?
   - What's been tried before? What failed and why?
   - What are the constraints (technical, business, timeline)?
   - What are the non-negotiables vs. the flexible?
   - Who are the stakeholders and what do they each care about?

### Step 4 — Produce Initial Observations

Write your findings as candidate memories. Present them to the human for review. Be explicit about your confidence levels:

- **High confidence:** Things you can verify from the code or documentation
- **Medium confidence:** Inferences from patterns you observed
- **Low confidence:** Guesses or intuitions that need validation

The human reviews each observation and either confirms, corrects, or rejects it. Confirmed observations enter `memories.json` with source `onboarding` and confidence based on the evidence level.

### Step 5 — Seed Portable Patterns (if `patterns.json` is empty)

If the portable patterns store is also empty, seed it with foundational patterns derived from known AI behavioral economics. These start at confidence 0.5 and origin `seed`:

**Suggested seeds:**

| ID | Category | Pattern | Countermeasure |
|---|---|---|---|
| pat_seed_001 | planning | AI tends to commit to the first viable approach without genuinely exploring alternatives | Always develop at least two substantively different approaches before recommending one |
| pat_seed_002 | execution | AI tends to defer fixes with "we can clean this up later" when deferral compounds | If it's in scope and needs doing, do it now. There is no future session that remembers this one |
| pat_seed_003 | communication | AI tends to mirror the human's words in polished language rather than genuinely engaging with intent | Backbrief must surface at least one assumption or gap the human didn't state |
| pat_seed_004 | calibration | AI tends to state uncertain claims with the same confident voice as verified facts | Explicitly flag confidence levels. Distinguish known from inferred from guessed |
| pat_seed_005 | economics | AI tends to estimate effort using human-scaled heuristics ("a quick 10-minute fix") that don't match its actual economics | Do not estimate effort in human time units. State what the work involves, not how long it "should" take |
| pat_seed_006 | execution | AI tends to declare completion before all success criteria are fully verified | Before declaring done, explicitly check each success criterion from the plan and verify it is met |
| pat_seed_007 | planning | AI tends to produce vague success criteria that can't be objectively measured | Every success criterion must be binary verifiable — it either happened or it didn't |
| pat_seed_008 | communication | AI tends to aim-to-please rather than push back on flawed assumptions | If the intent has a flaw, say so. The human hired an engineer, not a yes-man |

These seeds are hypotheses, not facts. They must be confirmed through observation (via cross-check or review) to reach confidence > 0.7.

---

## Onboarding Complete When

All of the following are true:

1. The AI has explored the codebase or intent thoroughly
2. Initial observations have been presented to the human and reviewed
3. Confirmed observations have been written to `memories.json`
4. Portable patterns have been seeded (if needed) or loaded (if they exist)
5. The human confirms the AI has sufficient context to begin Phase 1 planning

**Only then does normal operation begin.**

**Note:** The cross-check agent is not involved during onboarding. Phase 0 observations are reviewed by the human directly. The adversarial cross-check loop begins in Phase 1 when actual planning starts.

---

## Re-Onboarding

A human can trigger re-onboarding at any time. This is useful when:
- The codebase has changed significantly since the last session
- The AI's memories seem stale or misaligned
- The project intent has shifted
- A new human is joining the project and wants to recalibrate

Re-onboarding does NOT clear existing memories. It adds to them. The AI re-explores with fresh eyes, and new observations are reconciled with existing ones. Contradictions are flagged explicitly — they may indicate drift in the project or decay in the memory store.
