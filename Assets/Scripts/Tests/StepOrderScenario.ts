import {getInteractables} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DEVICE_IDS, VolatileTestSupport} from "./VolatileTestSupport"

/**
 * Done criterion 3: with step 2 active, pinching Done completes step 2 only; step 3 becomes
 * active and later steps stay locked. Steps can't be completed out of order.
 */
@component
export class StepOrderScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileTestSupport()
    const c = t.controller
    await t.waitReady()

    // Use the first device that can still have step 2 active with a step 3 after it.
    const id = DEVICE_IDS.find((d) => c.getStepCount(d) >= 3 && c.getCompletedCount(d) <= 1)
    if (!id) throw new Error("No device left with step 2 still to do. Reset the preview and run again.")
    const steps = c.getStepCount(id)

    try {
      await t.lookAt(id)
      if (c.getCompletedCount(id) === 0) await t.pinchDone(id)

      // Step 2 is active.
      expect(c.getCompletedCount(id), "one step done before the pinch").toBe(1)
      expect(c.getActiveStepIndex(id), "step 2 is active").toBe(1)
      expect(t.stepHighlighted(id, 2), "step 2 highlighted").toBe(true)

      // Only the current step can be completed: there is exactly one enabled Done button for
      // this device, it sits between step 2 and step 3, and no step row is pinchable itself.
      const doneButtons = getInteractables({enabledInHierarchy: true, sceneObjectName: "DoneButton " + id})
      expect(doneButtons.length, "exactly one Done button").toBe(1)
      const doneY = t.object("DoneButton " + id).getTransform().getLocalPosition().y
      const step2Y = t.stepRow(id, 2).getTransform().getLocalPosition().y
      const step3Y = t.stepRow(id, 3).getTransform().getLocalPosition().y
      expect(doneY < step2Y && doneY > step3Y, "Done button is right under step 2, above step 3").toBe(true)
      const pinchableInStack = getInteractables({enabledInHierarchy: true, ancestorName: "StepStack " + id}).filter(
        (i) => i.getSceneObject().name.indexOf("Step ") === 0
      )
      expect(pinchableInStack.length, "step rows are not pinchable").toBe(0)

      const logBefore = c.getCustodyLog().length

      // One pinch on Done.
      await t.pinchDone(id)

      // Step 2 only was completed.
      expect(c.getCompletedCount(id), "exactly one more step done").toBe(2)
      expect(t.stepText(id, 2).indexOf("✓") === 0, "step 2 is checked").toBe(true)
      expect(t.stepHighlighted(id, 2), "step 2 no longer highlighted").toBe(false)

      // Step 3 is now active.
      expect(c.getActiveStepIndex(id), "step 3 is active").toBe(2)
      expect(t.stepHighlighted(id, 3), "step 3 highlighted").toBe(true)
      expect(t.stepText(id, 3).indexOf("✓"), "step 3 not checked").toBe(-1)

      // Later steps stay locked.
      for (let n = 4; n <= steps; n++) {
        expect(t.stepText(id, n).indexOf("✓"), "step " + n + " not checked").toBe(-1)
        expect(t.stepHighlighted(id, n), "step " + n + " locked (not highlighted)").toBe(false)
      }

      // The Done button moved down to sit under step 3.
      const newDoneY = t.object("DoneButton " + id).getTransform().getLocalPosition().y
      const newStep3Y = t.stepRow(id, 3).getTransform().getLocalPosition().y
      expect(newDoneY < newStep3Y, "Done button moved under step 3").toBe(true)

      // The entry written belongs to step 2, not to a later step.
      const log = c.getCustodyLog()
      expect(log.length, "one custody entry for the one pinch").toBe(logBefore + 1)
      expect(log[log.length - 1].deviceId, "entry is for this device").toBe(id)
    } finally {
      t.releaseGaze()
    }
  }
}
