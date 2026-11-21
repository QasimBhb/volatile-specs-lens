---
status: approved
---

# Design brief: Volatile

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

A Lens for digital forensics first responders. At an incident scene, such as a ransomware hit at a small office, there are live devices: a running laptop, a router, a phone, a USB drive. One wrong move (powering off the laptop, unplugging the router) destroys volatile evidence like RAM, network connections and logged-in sessions. Volatile tags each device with its order-of-volatility rank and the next safe action, and a pinch logs each step to a timestamped chain of custody. The responder keeps gloves on and eyes on the evidence instead of juggling a clipboard.

## The one spatial moment
Gloves on, stopped about a meter from the desk, looking at the open, running laptop. A red tag snaps onto the top edge of its lid, sized to the laptop and facing me: **"#1 MOST VOLATILE: DON'T POWER OFF."** Right beside the lid, numbered steps stack vertically, about the height of the screen, with step 1 highlighted. I take the photo with my own evidence camera, pinch Done, and step 1 checks off with a soft click. A custody line appears at the bottom of the stack: "14:32:07, Laptop (LAP-01), screen photographed." Step 2 lights up. When I glance at the router and phone, they already carry smaller grey chips with their rank (#2, #3), so I know where to go next without them competing with the laptop.

## Why it belongs on glasses
- Uses: shares your view (what you look at is what gets tagged), draws in the world (the tag and steps sit on the device itself), leaves your body free (gloved hands stay on the evidence, eyes stay up).
- Why it's better than the phone or laptop version: a responder at a live scene can't hold a phone or clipboard with gloved hands while handling evidence, and a checklist on a screen doesn't say which physical device comes first. Putting the rank and the next safe action on the device itself prevents the wrong move.

## Product or overlay
- Type: overlay. It responds to real devices at a scene.
- What the real version would sense: object recognition of each device (laptop, router, phone, USB drive) as the responder looks at it.
- Stand-in for the preview:
  - A stand-in desk with simple 3D stand-in devices: laptop (open, screen on), router, phone (screen on), USB drive. Label each one **"preview stand-in"** in the scene hierarchy and in the README, to make clear that on real glasses this would be object recognition.
  - **Gaze dwell stands in for recognition.** When a device is near the center of view and within about 2 m for about 1 second, a thin ring traces around it as a "scanning" cue, then its chip expands into the full tag and step stack.
  - The photo is a real-world action taken with the responder's own evidence camera. The Lens is not the evidence device. The pinch only records that the photo happened, with a timestamp and device ID.

## Where things live
- Where the user is looking during the main task: at the device they're working on, about 1 m away at the desk, plus its step stack beside it.
- Stand-in desk: real size, about 120 × 60 cm, 75 cm high (default), placed about 1 m in front of the start position.
- Stand-in devices, in volatility order:
  1. Laptop (LAP-01, running, unlocked): on the desk, center (default).
  2. Router (NET-01): on the desk's right end or a side surface, off to the side but within about 1 to 1.5 m of the user (default).
  3. Phone (PH-01, screen on): on the desk, right of the laptop (default).
  4. USB drive (USB-01): on the desk near the phone, small but visible (default).
  - Nothing is placed behind the start position (default).
- Rank chip (every device, from start): small grey chip with the rank number (#1 to #4), on or just above each device, facing the user, about 5 cm wide (default).
- Full tag (when a device is scanned): snaps onto the top edge of the device. For the laptop it's red, sized to the lid's width, facing the user: "#1 MOST VOLATILE: DON'T POWER OFF." Other devices get a tag sized to the device with their rank and headline.
- Step stack: beside the device, facing the user, about the height of the laptop screen (about 20 to 25 cm, default). For the laptop it sits on the right side of the lid (default), since the Log chip takes the front-left corner. Numbered steps stack vertically; the active step is highlighted. The latest custody line shows at the bottom of the stack.
- Done button: one big, palm-sized button (about 8 to 10 cm, default) pinned right under the active step. It moves down as steps complete.
- Log chip: on the desk, front-left corner, next to the laptop. Small chip that says "Log."
- Custody log list: opens from the Log chip, on the desk next to it, facing the user (default).
- "Scene secured" banner: green, over the desk.
- Nothing floats in front of the face or is fixed to the view.

## Hands and input
- Complete a step: pinch the big Done button under the active step. Only the current step can be completed, so steps can't be done out of order (order matters in forensics). Pinching Done checks the step, plays a soft click, and writes the custody line.
- Open or close the custody log: pinch the Log chip on the desk.
- Scan a device: look at it (gaze dwell, see above). No hand action needed.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Rank chips: show on all four devices from start, like a first survey of the room. Grey = untouched, amber = in progress, green check = done.
- Full tag and step stack: show after about 1 second of gaze on a device (ring traces first). Collapse back to the chip when the user looks away; progress is kept.
  - Gaze target and collapse timing (default): the device, its tag, its step stack and its Done button count as one gaze target, so looking at the stack or reaching for Done doesn't collapse it. It collapses only after about 1.5 to 2 seconds looking clearly away.
- Custody line: appears at the bottom of the step stack after each Done.
- Custody log list: hidden by default. Shows when the Log chip is pinched, hides when it's pinched again. Lists every entry: time, device ID, action.
- Timestamps: the real clock time at the moment of the pinch (default).
- Finishing a device (default): its chip turns green with a check and a chime plays. If the next device is out of view, a small arrow appears at the finished device's stack, pointing toward the next device. The arrow is attached to the finished device, not to the view.
- "Scene secured": when every step on every device is done, a green "Scene secured" banner appears over the desk with the total time (counted from Lens start, default), and a chime plays.
- If something needs attention out of view: chime plus a small arrow at the finished device (default).

### Devices and steps
1. **Laptop (LAP-01, running, unlocked):** 1. Photograph screen. 2. Capture RAM. 3. Note open sessions and network connections. 4. Isolate from network.
2. **Router (NET-01):** 1. Photograph status lights and cabling. 2. Export connection table. 3. Leave powered on.
3. **Phone (PH-01, screen on):** 1. Photograph screen. 2. Airplane mode. 3. Faraday bag.
4. **USB drive (USB-01):** 1. Photograph in place. 2. Bag and label.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. On start, all 4 stand-in devices show a grey rank chip (#1 to #4) and no full tags.
2. Looking at the laptop from about 1 m for about 1 second traces a ring around it, then expands its red "#1 MOST VOLATILE: DON'T POWER OFF" tag and step stack with step 1 highlighted.
3. With step 2 active, pinching Done completes step 2 only; step 3 becomes active and later steps stay locked. Steps can't be completed out of order.
4. Each Done adds exactly one custody entry with the time, device ID and action. It shows at the bottom of the stack and in the list opened from the Log chip on the desk.
5. Finishing every step on all four devices shows the green "Scene secured" banner over the desk with the total time.

## Out of scope
- Real object recognition (gaze dwell on stand-ins replaces it).
- Real photo capture. The Lens is not the evidence device.
- Multiplayer or sharing the scene with another responder.
- Exporting the custody log or saving it between sessions.
- Recording, identifying or following people.

## Risks and open questions
- Gaze dwell in tests: a person can check criterion 2 in the preview by walking and looking. LEAF mainly simulates pinches and SIK interactions, not head pose, so its test may need to move the preview camera or call the scan directly. If it can't be automated, say so.
- Gaze collapse vs. the Done button: if the collapse rule is too strict, the stack could close while the user looks at it or reaches for Done. The one-gaze-target and 1.5 to 2 s defaults above are meant to prevent this. Tune them in the preview.
- Feel unproven: comfort of gaze dwell over time, glove-friendly pinching with real hand tracking, and real recognition can only be judged on glasses.

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
