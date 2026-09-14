# Keel — flow diagrams

Source of truth is `Keel-FlowMap-v2.xlsx` (76 transitions, each with its failure path).
These diagrams are orientation only — they show success paths, and each answers one question.

## Main navigation

*Question: which screens carry the traffic?*

```mermaid
flowchart TD
  S01["S01 Sign in"] --> S03["S03 Today"]
  S02["S02 Create account"] --> S04["S04 Today, no objective yet"]
  S04 --> S06["S06 New objective"]
  S03 -->|new objective| S06
  S06 -->|create| S07["S07 Objective overview"]
  S03 -->|open an objective| S07
  S03 -->|log a deviation| S13["S13 Log a deviation"]
  S13 -->|record| S03
  S03 -->|park an idea| S14["S14 Parking lot"]
  S03 --> S05["S05 Objectives"]
  S05 -->|open| S07
  S07 --> S08["S08 Effort"]
  S07 --> S09["S09 Reviews"]
  S07 -->|start review| S11["S11 Review"]
  S11 -->|save| S07
  S09 -->|open a saved one| S10["S10 Review detail"]
```

Today (S03) is the hub and Objective overview (S07) is the second. Almost nothing reaches a deep
screen without passing through one of them — which is where NFR-03's query budget is spent.

Drawn from T12–T22, T29–T31.

## The review draft loop

*Question: how do you get into and out of an unsaved review?*

```mermaid
flowchart LR
  S07["S07 Objective overview"] -->|start review| S11["S11 Review"]
  S11 -->|typing pauses, autosaved| S24["S24 Unsaved draft"]
  S24 -->|resume| S11
  S24 -->|discard, needs a confirm| S09["S09 Reviews list"]
  S09 -->|open the draft row| S11
  S07 -->|start review, a draft exists| S24
  S11 -->|save| S07
```

S24 is a state, not a screen — you fall into it by walking away mid-review. Two entrances
(S07, S09) and two exits (resume, discard). The two exits were missing from the first version
of the flow map; drawing it as a loop is how they became obvious.

Drawn from T31, T44, T49, T71, T75, T76.

---

Rule for adding to this file: never draw the whole system. Draw the subset that answers a
question, and put the question above the diagram.
