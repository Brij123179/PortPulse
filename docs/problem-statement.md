# Problem Statement — PortPulse

## Who Is Affected
Shift supervisors, terminal managers, and vessel planners at container ports — the people who currently allocate berths, cranes, and yard space using manual spreadsheets and experience-based judgment. The downstream victims of failure here are much bigger: every business whose goods move through that port, and ultimately consumers facing shortages and price spikes when the supply chain backs up.

## The Specific Pain
- Berth/crane/yard allocation across hundreds of vessels is done manually, reactively, and in silos — planners respond to a queue that has *already formed*.
- Congestion hotspots are identified only after ships are already waiting offshore, at which point rerouting or re-sequencing decisions are far more costly and far less effective than they would have been 24–72 hours earlier.
- There is no single system that fuses vessel schedule data, berth/crane capacity, and historical turnaround patterns into a forward-looking view — the pieces exist in different tools and different people's heads.

## Why Existing Solutions Don't Solve It
Terminal Operating Systems (e.g., Navis N4) track *current* state well — what's berthed now, what's scheduled next — but they are not predictive. They tell you what's happening, not what will happen in 72 hours if nothing changes, and they don't generate a recommended fix, a cost/impact estimate for that fix, or a plain-language plan a supervisor can hand off at shift change. Spreadsheet-based planning is even further behind: it's a static snapshot, redone by hand every time something changes.

## Quantified Pain
- The 2021 LA/Long Beach port backlog: 100+ vessels queued offshore for weeks, an estimated **$10B+** in downstream supply-chain cost.
- Manual spreadsheet planning takes hours to redo after a single schedule change; an automated system can re-optimise and regenerate a plan in seconds — a difference that matters directly during a live congestion event, not just as an efficiency statistic.
- Every hour of undetected congestion risk compounds: one delayed vessel cascades into berth conflicts for every vessel scheduled after it (see `docs/ml-engineering.md` for how PortPulse models this cascade explicitly).

## Why This Matters Now
Global shipping volumes and vessel sizes have both grown, while port infrastructure has not scaled proportionally — meaning smaller disruptions (a single crane outage, a cluster of mega-ship arrivals) now have outsized cascading effects. At the same time, the sensor and schedule data needed to predict these disruptions already exists; it's simply not being fused into a forward-looking, prescriptive tool. The technology gap, not the data gap, is what PortPulse closes.
