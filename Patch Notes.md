# Patch Notes

## 12/13/2025
### Known Bugs
- Switching off of Select Phase with a Country focused will cause all markers to scale and move with that country until next refresh, regardless of what country the markers may belong to.

## 12/12/2025
### Features Planned
- ~~Stealing currency from enemy nodes~~ `@ 12/13/2025`
  - ~~Update target layout data with deducted currnecy amounts~~ `@ 12/13/2025`
    - Prevent attacks on currently online users to ~~avoid gamedata desync~~ `@ 12/13/2025`
- Actual background
- Display Node Detail menu when purchasing new Nodes
### Known Bugs
- Clicking a newly created node sometimes retrieves an undefined NodeID, crashing OverlayManager
- ~~Collecting Credits can exceed storage limit~~ `@ 12/13/2025`
- Number of steps from nearest Access Port Node is improperly counted (9 max - flagged at 7 steps - internally read as 11)
- Node Detail menu does not display line breaks on mobile (iOS Safari)
- Save debug file button can crash page (pressing forced a reload while testing)
- CashFarm, CreditFarm, CashStore, and CreditStore node emissive set too high while dragging (appears fully bright white instead of tinged red)
- ~~Scene background images are incorrectly stored and fails to load (git page version saves unintended part of url path)~~ `@ 12/12/2025`
