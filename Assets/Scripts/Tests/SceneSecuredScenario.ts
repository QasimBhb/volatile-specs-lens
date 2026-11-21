import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DEVICE_IDS, VolatileTestSupport} from "./VolatileTestSupport"

/**
 * Done criterion 5: finishing every step on all four devices shows the green "Scene secured"
 * banner over the desk with the total time.
 */
@component
export class SceneSecuredScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileTestSupport()
    const c = t.controller
    await t.waitReady()

    try {
      let totalSteps = 0
      for (const id of DEVICE_IDS) totalSteps += c.getStepCount(id)
      const alreadySecured = c.isSceneSecured()
      if (!alreadySecured) expect(t.object("SceneSecuredBanner").enabled, "banner hidden until the last step").toBe(false)

      // Work through the devices in volatility order, one Done pinch per remaining step.
      for (const id of DEVICE_IDS) {
        if (c.getActiveStepIndex(id) < 0) continue
        await t.lookAt(id)
        let guard = 0
        while (c.getActiveStepIndex(id) >= 0) {
          if (++guard > 10) throw new Error("Done button is not completing steps on " + id)
          const remainingBefore = c.getStepCount(id) - c.getCompletedCount(id)
          if (!alreadySecured && remainingBefore > 1) expect(c.isSceneSecured(), "not secured mid-way").toBe(false)
          await t.pinchDone(id)
        }
        // A finished device: green chip with a check, no Done button left.
        expect(c.getChipState(id), id + " chip state").toBe("done")
        expect(t.object("DoneButton " + id).enabled, id + " Done button gone").toBe(false)
      }
      await sleep(300)

      // Every step on every device is done, once each.
      for (const id of DEVICE_IDS) expect(c.getCompletedCount(id), id + " all steps done").toBe(c.getStepCount(id))
      expect(c.getCustodyLog().length, "one custody entry per step").toBe(totalSteps)

      // Green banner over the desk, with the total time.
      expect(c.isSceneSecured(), "scene secured").toBe(true)
      const banner = t.object("SceneSecuredBanner")
      expect(banner.enabled, "banner shown").toBe(true)
      expect(t.textOf("SceneSecuredBanner", "Banner Title"), "banner title").toBe("SCENE SECURED")
      const timeText = t.textOf("SceneSecuredBanner", "Banner Time")
      expect(/^Total time \d\d:\d\d$/.test(timeText), "banner shows total time as mm:ss, got " + timeText).toBe(true)
      const green = t.plateColor("SceneSecuredBanner", "Banner Plate")
      expect(green.g > 0.5 && green.r < 0.3 && green.b < 0.4, "banner is green").toBe(true)

      // "Over the desk": above the desk top and within the desk's footprint.
      const bannerPos = banner.getTransform().getWorldPosition()
      const deskTop = t.object("Desk Top").getTransform()
      const deskPos = deskTop.getWorldPosition()
      const deskScale = deskTop.getWorldScale()
      expect(bannerPos.y > deskPos.y + 20, "banner is above the desk").toBe(true)
      expect(Math.abs(bannerPos.x - deskPos.x) < deskScale.x / 2 && Math.abs(bannerPos.z - deskPos.z) < deskScale.z / 2, "banner is over the desk footprint").toBe(true)

      // Chips: every device green with a check after collapsing back.
      await t.lookAway()
      for (let i = 0; i < DEVICE_IDS.length; i++) {
        const id = DEVICE_IDS[i]
        expect(t.textOf("RankChip " + id, "Chip Text"), id + " chip text").toBe("#" + (i + 1) + " \u2713")
        const chip = t.plateColor("RankChip " + id, "Chip Plate")
        expect(chip.g > chip.r + 0.2 && chip.g > chip.b + 0.2, id + " chip is green").toBe(true)
      }
    } finally {
      t.releaseGaze()
    }
  }
}
