import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DEVICE_IDS, VolatileTestSupport} from "./VolatileTestSupport"

/**
 * Done criterion 1: on start, all 4 stand-in devices show a grey rank chip (#1 to #4)
 * and no full tags.
 *
 * This checks the start state, so run it on a freshly reset preview, before the other
 * scenarios, with the preview camera not aimed at a device.
 */
@component
export class StartChipsScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileTestSupport()
    await t.waitReady()

    expect(t.controller.getDeviceIds().length, "device count").toBe(4)

    for (let i = 0; i < DEVICE_IDS.length; i++) {
      const id = DEVICE_IDS[i]
      const chip = t.object("RankChip " + id)
      expect(chip.enabled, id + " chip visible").toBe(true)
      expect(chip.getParent().name.includes("(preview stand-in)"), id + " chip sits on its stand-in device").toBe(true)
      expect(t.textOf("RankChip " + id, "Chip Text"), id + " chip rank").toBe("#" + (i + 1))
      expect(t.controller.getChipState(id), id + " chip state").toBe("untouched")

      // Grey: red, green and blue close to each other.
      const c = t.plateColor("RankChip " + id, "Chip Plate")
      expect(Math.abs(c.r - c.g) < 0.1 && Math.abs(c.g - c.b) < 0.1, id + " chip is grey").toBe(true)

      expect(t.object("Tag " + id).enabled, id + " full tag hidden").toBe(false)
      expect(t.object("StepStack " + id).enabled, id + " step stack hidden").toBe(false)
      expect(t.controller.isExpanded(id), id + " not expanded").toBe(false)
    }

    expect(t.object("SceneSecuredBanner").enabled, "banner hidden at start").toBe(false)
    expect(t.object("CustodyLog").enabled, "custody log hidden at start").toBe(false)
  }
}
