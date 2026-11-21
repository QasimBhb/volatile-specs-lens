# Volatile

A SPECS Lens for digital forensics first responders. At a live incident scene it tags each device with its order-of-volatility rank and the next safe action, and a pinch logs each step to a timestamped chain of custody.

Built from `devpost/design-brief.md`. Runs in Lens Studio's preview (SPECS, Interactive mode). It has not been run on a SPECS device.

## What is a preview stand-in

The real Lens would recognise each device as the responder looks at it. That is out of scope here, so the preview uses stand-ins. Every one is named **"(preview stand-in)"** in the Scene Hierarchy:

| Stand-in | What it replaces on real glasses |
| --- | --- |
| `Desk (preview stand-in)`, 120 × 60 cm, 75 cm high, 1 m in front of the start position | The real desk |
| `Laptop LAP-01 (preview stand-in)`, open, screen on | Object recognition of the laptop |
| `Router NET-01 (preview stand-in)` | Object recognition of the router |
| `Phone PH-01 (preview stand-in)`, screen on | Object recognition of the phone |
| `USB Drive USB-01 (preview stand-in)` | Object recognition of the USB drive |

**Gaze dwell stands in for recognition.** When a device is near the centre of view and within about 2 m for about 1 second, a thin ring traces around it, then its chip expands into the full tag and step stack.

**The Lens is not the evidence device.** The responder takes photos with their own evidence camera. Pinching Done only records that the step happened, with the clock time and device ID.

## Using it in the preview

1. Open `Test_1.esproj` in Lens Studio. The Preview panel should be on SPECS, Interactive.
2. The desk is at real height, so it is below eye level. Right-drag (or hold Shift) to look down at it. WASD moves, Q and E go down and up.
3. All four devices carry a grey rank chip (#1 to #4).
4. Look at the laptop for about a second. A ring traces, then the red tag **"#1 MOST VOLATILE: DON'T POWER OFF"** and the step stack appear, with step 1 highlighted.
5. Click (pinch) the big **DONE** button under the active step. The step checks off, a click plays, and a custody line appears at the bottom of the stack. The button moves down to the next step.
6. Click the **Log** chip at the desk's front-left corner to open or close the custody log.
7. Finish every step on all four devices to get the green **SCENE SECURED** banner with the total time.

Chips are grey when untouched, amber when in progress and green with a check when done. Looking away for about 1.75 seconds collapses the tag and stack back to the chip; progress is kept.

## Files

- `Assets/Scripts/VolatileData.ts`: the devices, their steps, headlines and where the chip, tag and stack sit.
- `Assets/Scripts/VolatileController.ts`: gaze dwell, scan ring, tags, step stacks, Done button, custody log, banner and sounds. Dwell time, collapse time, scan range and gaze margin are inputs on the `Volatile` object.
- `Assets/Scripts/Tests/`: LEAF scenarios, one per done criterion.

## Tests

Five LEAF scenarios are registered in `Assets/Scripts/Tests/LeafIndex.ts`:

| Scenario | Done criterion |
| --- | --- |
| `volatile-1-start-chips` | 1. Grey chips #1 to #4 on start, no full tags |
| `volatile-2-gaze-dwell-expands-laptop` | 2. About 1 s of gaze traces the ring, then expands the red tag and stack |
| `volatile-3-done-completes-current-step-only` | 3. Done completes the current step only |
| `volatile-4-custody-entry-per-done` | 4. One custody entry per Done, in the stack and in the Log list |
| `volatile-5-scene-secured-banner` | 5. Green "Scene secured" banner with total time |

To run one without the LEAF panel: select the `LeafIndex` object, type the scenario ID into **Scenario Id** on its `VolatileLeafRunner` script, and reset the preview. The result prints to the Logger as `[LEAF-RUN] PASSED …` or `FAILED …`. Clear the field afterwards. Start with the preview camera at its default pose, not aimed at a device.

LEAF cannot turn the responder's head, so the scenarios set a simulated gaze (`setSimulatedGaze`) in place of head pose. The dwell timer, ring, expand and collapse are the Lens's real logic. Done and Log are pinched through the real UI Kit buttons.

## Packages

Spectacles Interaction Kit 2.0.0, Spectacles UI Kit 2.0.0 and LEAF 2.0.2 (the LEAF version that matches Interaction Kit 2.0). Bitmoji 3D came in as a LEAF dependency.
