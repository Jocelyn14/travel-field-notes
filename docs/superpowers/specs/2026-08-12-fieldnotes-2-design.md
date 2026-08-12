# FIELDNOTES 2.0 Design

FIELDNOTES 2.0 keeps the four-view information architecture and upgrades the mobile interaction model. External links use direct top-level navigation with an explicit browser-opening affordance; bottom navigation updates immediately; AFTER HOURS uses click-only tabs and one vertical scroll surface.

The checklist becomes a continuous travel-preparation file. Reservation cards expose one next action that can be completed independently, with optional reference, payment, credential URL, and note fields. Preset and custom Todos share completion and deletion behavior; custom additions remain below the insertion form. Deleted preset items are persisted without mutating source trip data.

The existing shared title and editor-field systems remain the only typography and form implementations. The 2.0 polish removes prototype copy, capitalizes APP, simplifies the checklist hierarchy, and reviews both destination heroes at 393px and 430px. The undefined annotation feature is explicitly excluded.

Data migrations preserve older reservation statuses by mapping completed legacy states to `done: true`; all new records remain destination-local in the existing versioned localStorage envelope.
