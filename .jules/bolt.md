## 2026-05-04 - Pre-computing Sets for Scoring Hot Loops
**Learning:** In hill-climbing genetic algorithms like HeuristicSeedEngineer, performing repeated array `.includes()` checks inside a million-iteration maxGenerations loop is a severe bottleneck. By pre-processing static AnchorRound arrays into Sets before the loop starts, O(N) lookups become O(1), yielding massive performance gains.
**Action:** Always look for static data arrays inside hot mutation loops that can be hoisted and transformed into O(1) lookup structures like Sets or Maps before the loop execution begins.
