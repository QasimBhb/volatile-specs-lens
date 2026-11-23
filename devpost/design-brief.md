---
status: approved
---

# Design brief: Volatile (version 2)

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

A Lens for digital forensics first responders. At a scene with live devices (a laptop, a router, a phone, a USB drive), one wrong move destroys volatile evidence. Volatile asks a few state questions about each device, ranks the devices by urgency, puts the next safe steps and a "never do" warning on the device itself, and logs every answer to a timestamped chain of custody.

Version 2 replaces version 1's fixed rank (laptop #1 to USB #4). The research found that every first-responder standard read in full branches on device state (on or off, locked or unlocked), not device type. Source for all rules below: `devpost/research.md`.

## The one spatial moment
Gloves on, about a meter from the desk, I look at a device I haven't assessed. After about 1 second a ring traces around it and a question card opens beside it with two big pinch buttons: **On / Off**, then **Locked / Unlocked**, then **Being wiped? Yes / No**. When I answer, its grey "?" chip becomes a rank among the assessed devices with a one-line reason ("#1: on and unlocked, could lock"), and the other chips re-sort. Step cards open where the question card was, with a red "never do" strip on the device's tag. Each step asks me for a fact, not a tick ("Signal in bag: None / Still showing"), and my answer is logged with the time.

## Why it belongs on glasses
- Uses: shares your view (what you look at is what gets assessed), draws in the world (rank, steps and warnings sit on the device), leaves your body free (gloved hands, eyes up).
- Why it's better than the phone or laptop version: a responder can't hold a phone or clipboard with gloves on, and a paper checklist doesn't say which physical device is most urgent right now. The warning appears on the exact device it applies to.

## Product or overlay
- Type: overlay. It responds to real devices at a scene.
- What the real version would sense: recognition of each device as the responder looks at it. The state is always confirmed by the responder, not asserted by the Lens.
- Stand-in for the preview:
  - A stand-in desk with four simple stand-in devices: laptop, router, phone, USB drive (plugged into the laptop). Each is named **"preview stand-in"** in the scene hierarchy and the README.
  - **Gaze dwell stands in for recognition.** A device near the centre of view and within about 2 m for about 1 second gets a scan ring, then its card.
  - **The state questions are the real design**, not a stand-in: the responder answers them by pinch.
  - The stand-ins are dimmed so the interface is the brightest thing in view, and carry simple flat screens that show their state: a dim desktop on the laptop, a lock screen on the phone, lights on the router. No new 3D models.
  - Photos are taken with the responder's own evidence camera. The Lens is not the evidence device. A fact button only records what the responder saw.

## Where things live
- Where the user is looking during the main task: at the device being assessed, about 1 m away on the desk, with its card beside it.
- Stand-in desk: about 120 x 60 cm, real desk height, about 1 m in front of the start position (as version 1).
- Stand-in devices (as version 1): laptop LAP-01 centre, router NET-01 at the right end, phone PH-01 right of the laptop, USB drive USB-01 plugged into the laptop's side. Nothing behind the start position.
- Rank chip (every device): a numbered marker about 5.6 cm square, on or just above the device, facing the user. Grey with "?" until assessed. Then its rank among the assessed devices. While the device's card is closed, a small pill beside the marker carries the one-line reason.
- Question card: beside the device, facing the user, about 20 cm tall (default). One question at a time, two buttons.
- Step cards: in the same place as the question card, 20 cm wide and about 30 cm tall, 1 cm beside the device and never over its screen. The card tilts to face the user. Numbered, active step highlighted, later steps locked.
- Fact buttons: right under the active step. The question (the stem, such as "Radios:") sits above two buttons side by side, each about 8.6 x 5 cm, with a short label ("All off", "Still on"). Question-card buttons are the same size.
- "Never do" strip: red, on the top edge of the device, with the rank marker at its left end. Together they are as wide as the device, and at least about 22 cm on small devices (phone, USB drive) so the text fits. Strips and markers face the user, as cards do.
- Source chip: small, for example "INTERPOL 2021". It shows on the strip and on the active step only, so the card stays readable. Rules with no quoted source say "Inferred".
- "Contested" chip: amber, on the active step where standards disagree, with a one-line note naming the other view.
- Nudge line: small amber line at the bottom of the step cards, for example "#1 Laptop is still waiting".
- Reassess button: a small outlined capsule in the card's footer, under the custody line (about 8.6 x 4.5 cm, default).
- Phone clock: in the pill beside the phone's marker once it is answered Locked, so it shows whether the card is open or closed.
- Card height: grows with its content, from about 27 cm to about 36 cm when a Contested note, the nudge line and Reassess all show.
- Scan prompt: on the desk, centre-front, at start.
- Scenario toggle: on the desk, front-right corner. Two-way: **Criminal seizure / Ransomware response**.
- Log chip and custody log list: Log chip on the desk's front-left corner, list opens beside it (as version 1).
- "Scene secured" banner: green, over the desk.
- Nothing floats in front of the face or is fixed to the view.

## Hands and input
- Confirm the room scan: pinch "I've scanned" on the desk prompt.
- Answer a state question: pinch one of the two buttons on the question card.
- Complete a step: pinch the fact button that matches what you see. Steps within a device go strictly in order.
- Reassess a device: pinch Reassess in the footer of its card.
- Switch scenario: pinch the toggle on the desk.
- Open or close the log: pinch the Log chip.
- Scan a device: look at it (gaze dwell). No hand action.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Scan prompt: at start, "Scan the room, trace the cables" with an "I've scanned" button. Pinching it logs the scan and the prompt recedes.
- Rank chips: on all four devices from the start, grey "?". Each time a device is assessed, the assessed chips re-sort. With two devices assessed the ranks are #1 and #2; with all four, #1 to #4. Unassessed devices stay "?". Marker border: grey when unassessed, white when assessed but not started, amber while in progress, green with a check when done.
- Question card: after about 1 second of gaze on an unassessed device (ring first). Tailored per device:
  - Laptop and phone: On / Off, then Locked / Unlocked, then Being wiped? Yes / No. Answering Off skips the rest (default).
  - Router: On / Off only.
  - USB drive: Plugged into a running machine / Loose.
- Step cards, "never do" strip, source chip: as soon as the questions are answered. The device, its tag, cards and buttons count as one gaze target. They collapse to the chip after about 1.5 to 2 seconds of looking clearly away. Progress is kept.
- Working out of order: allowed. If a higher-ranked device is unfinished, the nudge line shows on the card.
- A fact that reveals a problem: the answer is logged, the step stays open, and a corrective line replaces the step text (for example "Reseal or change the bag"). A low, short tone plays and the step pulses forward once. The step closes when the other answer is pinched, unless the step names a different closing fact. A "Wiping" answer moves the device to the Being wiped state and to #1.
- Reassess: reopens the questions. When they are answered, one log entry records the old and new state ("PH-01, Reassessed: unlocked to locked"). If the answers change the state, the device gets the new state's steps from step 1; if they don't, progress is kept (default). Log entries are never removed.
- Scenario toggle: starts on Criminal seizure. Changing it is logged and moves the laptop's network step. Steps keep their done state by step, not by position. Only the network step reopens, because its question changes (default).
- Phone clock: starts when the phone is answered Locked. Counts up as "Locked for at least 00:04:12", with the note "vendor-reported, iPhone only: USB data may lock after about 1 hour locked, reboot to full encryption after about 72 hours".
- Finishing a device: its chip turns green with a check and a chime plays. If the next-ranked device is out of view, a small arrow on the finished device points toward it (default).
- Custody log: hidden until the Log chip is pinched. Each entry: time, device ID, action, fact. Example: "14:32:07, PH-01, Signal in bag: Still showing". Every fact-button pinch adds one entry, problem answers included. Each completed assessment adds one entry with the state ("PH-01, Assessed: on, locked, not wiping") (default). Reassessments, scenario switches and the room scan add one entry each. Timestamps are the real clock time (default).
- Scene secured: when every device is assessed and every step is done, a green "Scene secured" banner shows over the desk with the total time, and a chime plays. A "call trained personnel" step counts as done once the responder confirms the call.
- If something needs attention out of view: chime plus the small arrow on the finished device (default).

### Rank and reason
The urgency order is the research report's own synthesis, not a quoted standard. Say so in the README and video. Ties: the device assessed first ranks higher (default). Reason lines are (default).

| State | Tier | Reason line on the chip |
|---|---|---|
| Laptop or phone, being wiped | 1 | "wiping now, act first" |
| Laptop or phone, on and unlocked | 2 | "on and unlocked, could lock" |
| Phone, on and locked | 3 | "locked, could reboot or be wiped" |
| Laptop, on and locked | 3 (default; the report doesn't place it) | "locked but live, keep it powered" |
| Router, on | 4 | "leave on, call an expert" |
| Any device off; USB drive | 5 | "stable, can wait" |

### Devices, states and steps
Wording is (default), drawn from the research report. Square brackets give the source chip. Expert-only actions appear as "Call trained personnel", never as steps.

How to read a fact: `Stem: Answer A / Answer B`. An answer marked **problem** keeps the step open and shows the corrective line after the arrow. Unmarked answers are logged and the next step opens. In a closing fact, the second answer keeps the step open unless the step says otherwise. Where a step says an answer switches the device to another state, the device gets that state's rank, strip and steps, as Reassess would. Pulling power on a wiping laptop is not a switch: it stays in Being wiped until those steps are done.

**Laptop, on and unlocked.** Strip: "DON'T SHUT DOWN. DON'T TYPE OR CLICK." [NIJ 2008, INTERPOL 2021]
1. Photograph the screen with the date, time and time zone. Fact: `Screen: Normal / Wiping`. "Wiping" switches the laptop to Being wiped. [NIJ 2008, INTERPOL 2021]
2. Look, don't touch: encryption, mounted drives, cloud or remote sessions. Fact: `Any visible: Yes / No`. [INTERPOL 2021]
3. Don't shut down. Call trained personnel. Fact: `Trained staff: Coming / None free`. [INTERPOL 2021] "None free" is a **problem**:
   - If `Any visible` was Yes → "Keep it on. Keep trying to reach trained staff." Closes on "Coming". [INTERPOL 2021]
   - If `Any visible` was No → "Remove power at the device end, not the wall." Contested chip: "NIJ 2008 and ACPO 2012: remove power. INTERPOL 2021: keep it on if an expert can come." Closing fact: `Power: Removed / Still on`. "Removed" switches the laptop to Laptop, off. [NIJ 2008, ACPO 2012]
4. Network, by scenario:
   - Criminal seizure: "Network: a judgement call. Cutting it stops remote tampering but loses open connections. Ask trained staff." Contested chip: "ACPO 2012: weigh it. CISA 2023, for ransomware: isolate first." Fact: `Network: Left on / Cut`. [ACPO 2012]
   - Ransomware response: this step moves up to step 2 and reads "Isolate from the network now: unplug the network cable." Fact: `Isolated: Yes / Can't`. "Can't" is a **problem** → "Ask IT to cut the network at the switch. Only if that's impossible, remove power at the device end." Contested chip: "CISA 2023: power down only if it can't be isolated. Volatile memory is lost." Closing fact: `Fallback: Switch cut / Power removed`. Here both answers close the step; "Power removed" switches the laptop to Laptop, off. [CISA 2023]

**Laptop, on and locked.** Strip: "DON'T SHUT DOWN OR RESTART. DON'T TYPE." [NIJ 2008, ACPO 2012]
1. Photograph the screen with the date, time and time zone. Fact: `Screen: Lock screen / Other`. [ACPO 2012, INTERPOL 2021]
2. Ask the user for the password and write it down. Fact: `Password: Given / Not given`. [ACPO 2012]
3. Call trained personnel. Fact: `Trained staff: Coming / None free`. "None free" is a **problem** → "Keep it on and powered. Keep trying to reach trained staff." Contested chip: "NIJ 2008 and ACPO 2012 would remove power if no encryption is suspected." [INTERPOL 2021]

**Laptop, off.** Strip: "DON'T SWITCH IT ON." [NIJ 2008, ACPO 2012]
1. Photograph it and its cables. Fact: `Lid: Open / Closed`. [NIJ 2008, ACPO 2012]
2. Label cables and ports, then unplug at the device end, not the wall. Fact: `Unplugged: At device / No cable`. [NIJ 2008, ACPO 2012]
3. Record make, model and serial. Fact: `Serial: Recorded / Unreadable`. [NIJ 2008, ACPO 2012]

**Router, on.** Strip: "DON'T LOG IN." [ACPO 2012]
1. Photograph the status lights and cabling. Fact: `Lights: Blinking / Steady`. [Inferred]
2. Record make, model and visible network names. Fact: `Label: Recorded / Unreadable`. [NIJ 2008]
3. Leave it powered on and flag it for an expert. Fact: `Expert: Flagged / Not yet`. "Not yet" is a **problem** → "Flag it before you leave the room." [Inferred]

**Router, off.** Strip: "DON'T SWITCH IT ON." [Inferred]
1. Photograph it and its cabling. Fact: `Cables: Connected / Loose`. [Inferred]
2. Record make and model. Fact: `Label: Recorded / Unreadable`. [Inferred]
3. Flag it for an expert. Fact: `Expert: Flagged / Not yet`. "Not yet" is a **problem** → "Flag it before you leave the room." [Inferred]

**Phone, on and unlocked.** Strip: "DON'T LET IT LOCK." [SWGDE 2025]
1. Photograph the screen. Fact: `Screen: Unlocked / Locked`. "Locked" is a **problem** → "It has locked. Pinch Reassess." [SWGDE 2025]
2. Keep the screen awake and connect power. Fact: `Power: Connected / No charger`. [SWGDE 2025]
3. Check the radios. Airplane mode alone may leave Bluetooth and Wi-Fi on. Fact: `Radios: All off / Still on`. "Still on" is a **problem** → "Shield the phone now." Closing fact: `Shielded: Yes / Not yet` ("Not yet" keeps the step open). [SWGDE 2025]
4. Faraday bag: power bank inside, no cable crossing the shield. Fact: `Signal in bag: None / Still showing`. "Still showing" is a **problem** → "Reseal or change the bag." [SWGDE 2025]

**Phone, on and locked.** Strip: "DON'T GUESS THE PASSCODE." [SWGDE 2025] The clock shows.
1. Photograph the screen. Fact: `Screen: Lock screen / Notifications`. [SWGDE 2025]
2. Connect power so it doesn't reboot. Fact: `Power: Connected / No charger`. [SWGDE 2025]
3. Faraday bag: power bank inside, no cable crossing the shield. Fact: `Signal in bag: None / Still showing`. "Still showing" is a **problem** → "Reseal or change the bag." [SWGDE 2025]
4. Move it to acquisition now. Fact: `Handover: Done / Waiting`. "Waiting" is a **problem** → "Keep it powered and shielded until handover." [SWGDE 2025]

**Phone, off.** Strip: "DON'T POWER ON. DON'T CHARGE." [SWGDE 2025]
1. Photograph it. Fact: `Condition: Intact / Damaged`. [SWGDE 2025]
2. Record the model and visible identifiers. Fact: `IDs: Recorded / Not visible`. [SWGDE 2025]
3. Bag it. Leave the SIM and card in. Fact: `Bagged: Yes / No bag`. [SWGDE 2025, INTERPOL 2021]

**USB drive, plugged into a running machine.** Strip: "DON'T PULL IT OUT YET." [Inferred]
1. Photograph it in place. Fact: `Light: Blinking / Off`. [NIJ 2008]
2. Label the drive and the port it's in. Fact: `Labelled: Both / Drive only`. "Drive only" is a **problem** → "Label the port too." [NIJ 2008, INTERPOL 2021]
3. Wait for the laptop's live-capture decision. Fact: `Laptop decision: Made / Not yet`. "Not yet" is a **problem** → "Leave it in. Come back after the laptop." [Inferred]
4. When trained staff say so: remove it and bag it in anti-static packaging. Fact: `USB: Bagged / Left for staff`. [INTERPOL 2021]

**USB drive, loose.** Strip: "DON'T PLUG IT IN TO CHECK." [INTERPOL 2021]
1. Photograph it in place. Fact: `Near a machine: Yes / No`. [NIJ 2008]
2. Label it. Fact: `Labelled: Yes / No labels`. [NIJ 2008, INTERPOL 2021]
3. Bag it in anti-static packaging. Fact: `Bag: Anti-static / Other bag`. [INTERPOL 2021]

**Laptop, being wiped.** Rank #1. Strip: "ACT NOW." [NIJ 2008, INTERPOL 2021]
1. Pull power at the device end now. Fact: `Power: Pulled / Still on`. "Still on" is a **problem** → "Remove the battery if you can. Call trained staff now." [NIJ 2008, INTERPOL 2021]
2. Photograph the screen and cabling as left. Fact: `Screen: Dark / Still lit`. [NIJ 2008]
3. Call trained personnel. Fact: `Trained staff: Coming / None free`. "None free" is a **problem** → "Keep trying to reach trained staff." [INTERPOL 2021]

**Phone, being wiped.** Rank #1. Strip: "ACT NOW." [Inferred]
1. Shield it now: Faraday bag. Fact: `Signal in bag: None / Still showing`. "Still showing" is a **problem** → "Reseal or change the bag." [Inferred]
2. Call trained personnel. Fact: `Trained staff: Coming / None free`. "None free" is a **problem** → "Keep trying to reach trained staff." [Inferred]

## Look and feel
The look is "Forensic Tag". It was tried on the laptop in the preview on 2026-11-22 (`Assets/Scripts/Proof/VolatileLookProof.ts`, a throwaway script; captures in `notes/ui/`). The values below are the ones that proof used.

- **Colour means state only.** Red: never do. Amber: in progress, problem, contested. Green: done. Cyan: the active step and what you are aiming at. White: text. No yellow, because it sits too close to amber.
- **Dark panels, light text.** Panels are dark slate rounded rectangles with a thin lighter border. Colour appears as borders, bars and small marks, not as large bright fills. Very dark fills turn see-through on the display, so panel fills stay between about 10% and 30% brightness.
- **Card header.** Each card opens with a label-style header: the device ID on the left, its state on the right ("LAP-01", "ON · UNLOCKED"), a thin rule, then the rank and reason.
- **Rank marker.** A rounded square with a white numeral and a short bar under it. The border and bar carry the state colour: grey, white, amber or green. Beside a closed card's marker, a dark pill holds the reason in white and, for a locked phone, the clock in amber.
- **"Never do" strip.** Dark crimson fill, brighter red border, a round "!" badge, bold white text, with the source on a second line. On the laptop the marker sits at the left end of the strip and together they span the lid.
- **Active step.** A lighter row with a cyan bar down its left edge. It holds the step text, the source chip (a small outlined pill), the question, and the two fact buttons.
- **Fact buttons.** UI Kit buttons recoloured slate, capsule-shaped, clearly brighter than the active row behind them, with a cyan border when aimed at. Two 10 cm buttons do not fit a 20 cm card, so they are 8.6 cm wide; that still clears Snap's "large" target size at this distance.
- **Text.** Three sizes only: 56 (marker numerals, banner), 44 (steps, headers, button labels), 40 (captions, sources, custody lines). Medium weight or heavier.
- **Shape.** One corner radius for panels (about 1.2 cm), a smaller one for chips and rows, capsules for buttons.
- **Motion.** One curve and one duration (about 160 ms, ease-out). A card grows out of its marker. Markers slide when ranks re-sort. A problem answer makes the step pulse forward once. Nothing loops and nothing shakes.
- **Stand-ins.** Dimmed to about 60% of their colour. Router lights are blue-white, not green, so they are not read as "done".
- **Sound.** A click for each answer, a chime when a device or the scene is finished, and a low, short tone for a problem answer.
- **Monospaced timestamps and IDs** are optional. They were not tried in the proof; keep them only if they stay sharp in the preview.

## Done criteria
Each one can be checked in Lens Studio's preview. They are written around one run: laptop on and unlocked, phone on and locked, router on, USB drive plugged into the laptop.
1. On start, the desk shows the scan prompt, all four stand-ins show a grey "?" chip, and no cards are open. Pinching "I've scanned" hides the prompt and adds one log entry.
2. Looking at a stand-in for about 1 second traces a ring, then opens its question card. The laptop gets three questions, the router one.
3. Assessing in the order router, phone, laptop, USB re-sorts the chips each time: Router #1; then Phone #1, Router #2; then Laptop #1, Phone #2, Router #3; then USB #4. Each chip shows a one-line reason. The router shows "DON'T LOG IN" and the phone shows a "Locked for at least" clock counting up.
4. Steps complete only in order, each by a fact button, and every fact-button pinch adds exactly one custody entry (time, device ID, action, fact) on the card and in the Log list. The active step shows its source chip. Answering "Signal in bag: Still showing" on the phone or "Expert: Not yet" on the router keeps that step open with a corrective line.
5. Pinching the scenario toggle moves the laptop's network step to step 2 with the ransomware text, and pinching Reassess on the phone reopens its questions. The toggle adds one log entry when pinched; Reassess adds one when its questions are answered.
6. Finishing every step on all four devices shows the green "Scene secured" banner with the total time.

## Out of scope
- Real object or state recognition (gaze dwell and the questions replace it).
- Real photo capture. The Lens is not the evidence device.
- Voice, multiplayer, and saving the log between sessions.
- Exporting or hash-chaining the log. Whether a preview-only Lens can export a file is unknown.
- Exhibit labels, handover sign-off, voice notes, and extra devices (server, smart speaker).
- Encryption as a separate state question. It is a fact inside the laptop's steps.
- A network step on the locked laptop. The scenario toggle changes the unlocked laptop only.
- Recording, identifying or following people.

## Risks and open questions
- **Scope.** This is more than the suggested two-week cut: all four should-haves, plus Reassess, the nudge and corrective facts. Build in two layers, both for the one run in the done criteria first. Layer 1: scan prompt, questions, rank with reason and re-sorting, strips, step cards with fact buttons and corrective lines, phone clock, log, banner. Layer 2: source and Contested chips, scenario toggle, Reassess, nudge, then the states outside the run.
- **The look is proven only as a still.** The preview proof shows layout, colour and legibility from the start position. Hover and pinch feedback, motion and sound were not tried, and colour on real glasses may differ. Fitting the preview frame is not the same as fitting the usable width on SPECS: laptop plus card span 54 cm, about the limit at this distance.
- **Card over a neighbour.** At its tallest (about 36 cm) the laptop's card could reach the phone's marker and reason pill. While a card is open, hide or move neighbouring pills it would cover, and check this in the preview.
- **Warnings on the device, not at the edge of view.** The research report suggests an edge-of-view strip and keeping the centre clear. The learner chose on-device strips to keep "nothing fixed to the view". Check in the preview that cards beside a device don't cover it.
- **Do not overclaim.** No study measures how often first responders make seizure errors. No case was found where evidence was excluded for powering off or browsing. "No AR seizure tool was found", not "none exists". The phone timings are vendor-reported. Use the report's "safe to state" table for the video and README.
- **The urgency order is a synthesis**, not a standard, and router rules are inferred. Both are labelled on screen.
- **CISA wording.** The research report saw the CISA guide only through search summaries. Its web page was read directly on 2026-11-22: isolate impacted systems immediately, and power down only if they can't be disconnected. The report itself has not been updated.
- **Speed.** In one paramedic trial, smart glasses raised accuracy but roughly doubled time per patient. The run in the done criteria is about 25 pinches; check it fits a video under 3 minutes.
- **Gaze in tests.** LEAF can't move the head. Tests call `setSimulatedGaze`; real gaze is checked with the preview camera.
- **Feel unproven:** gloved pinching with real hand tracking, gaze dwell comfort, and real recognition.

## Carry-over from version 1
- This changes the existing Lens; it is not a new project. Keep the stand-in desk and devices, gaze dwell and scan ring, custody log, Log chip, banner, click and chime. Replace the fixed ranks and step lists.
- Keep the rules as data (state, tier, reason, strip, steps, facts, sources) so wording changes don't touch behaviour code.
- Start view: the desk is at real height, about 40 degrees below a level gaze. Nothing is visible until the user looks down.
- Packages: Spectacles Interaction Kit 2.0.0, UI Kit 2.0.0, LEAF 2.0.2. Don't upgrade them.
- Don't use `PreviewInteractTool`. It installs packages that break the compile. Drive pinches through LEAF.
- Run LEAF scenarios with the in-Lens `VolatileLeafRunner`; the LEAF panel is not available in this install.
- Build inline. Don't hand the whole build to the `specs-experience-builder` agent.
- UI Kit: put `Canvas` on the panel root and create the back plate before its content. Don't disable an object holding a UI Kit Button before it initialises.
- Recolouring a UI Kit Button: after `onInitialized`, set the gradients and border colours on `btn.visual`, set `defaultBorderType`, `hoveredBorderType` and `triggeredBorderType` to `"Color"`, then call `refreshRoundedRectangleState()`. Without the last two, the custom fill does not show and a hover brings back UI Kit's yellow border.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
