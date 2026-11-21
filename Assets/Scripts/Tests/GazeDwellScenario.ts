import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {VolatileTestSupport} from "./VolatileTestSupport"

/**
 * Done criterion 2: looking at the laptop for about 1 second traces a ring around it, then
 * expands its red "#1 MOST VOLATILE: DON'T POWER OFF" tag and step stack with the current
 * step highlighted (step 1 on a fresh start).
 *
 * LEAF cannot turn the responder's head, so the gaze is simulated with setSimulatedGaze.
 * The dwell timer, ring trace, expand and collapse are the Lens's real logic.
 */
@component
export class GazeDwellScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileTestSupport()
    const c = t.controller
    const id = "LAP-01"
    await t.waitReady()

    try {
      await t.lookAway()
      expect(t.object("Tag " + id).enabled, "tag hidden before looking").toBe(false)
      expect(t.object("RankChip " + id).enabled, "chip shown before looking").toBe(true)

      // Start looking at the laptop.
      c.setSimulatedGaze(id)
      await sleep(450)

      // Part-way through the dwell: the ring is tracing and nothing has expanded yet.
      const midway = c.getRingProgress()
      expect(midway, "ring has started tracing").toBeGreaterThan(0.1)
      expect(midway, "ring not complete yet").toBeLessThan(1)
      expect(t.object("ScanRing").enabled, "scan ring visible").toBe(true)
      expect(c.isExpanded(id), "not expanded before the dwell completes").toBe(false)
      expect(t.object("Tag " + id).enabled, "tag still hidden mid-dwell").toBe(false)

      // After about a second in total it expands.
      const started = getTime()
      await t.waitUntil(() => c.isExpanded(id), 2000, "laptop to expand")
      const dwell = 0.45 + (getTime() - started)
      expect(dwell, "dwell is about 1 second (not instant)").toBeGreaterThan(0.8)
      expect(dwell, "dwell is about 1 second (not slow)").toBeLessThan(1.6)
      expect(c.hasRingTraced(id), "ring fully traced before expanding").toBe(true)
      await sleep(150)

      // Red tag with the exact headline.
      expect(t.object("Tag " + id).enabled, "tag shown").toBe(true)
      expect(t.textOf("Tag " + id, "Tag Text"), "tag headline").toBe("#1 MOST VOLATILE: DON'T POWER OFF")
      const red = t.plateColor("Tag " + id, "Tag Plate")
      expect(red.r > 0.8 && red.g < 0.35 && red.b < 0.35, "tag is red").toBe(true)

      // Step stack with the current step highlighted, and only that one.
      expect(t.object("StepStack " + id).enabled, "step stack shown").toBe(true)
      expect(t.object("RankChip " + id).enabled, "chip replaced by the tag").toBe(false)
      const active = c.getActiveStepIndex(id)
      if (c.getCompletedCount(id) === 0) expect(active, "step 1 is the active step on a fresh start").toBe(0)
      for (let n = 1; n <= c.getStepCount(id); n++) {
        expect(t.stepHighlighted(id, n), "step " + n + " highlight").toBe(n === active + 1)
      }

      // Looking at the stack does not collapse it; looking clearly away does, after 1.5 to 2 s.
      await sleep(2200)
      expect(c.isExpanded(id), "stays open while being looked at").toBe(true)
      c.setSimulatedGaze("away")
      await sleep(1000)
      expect(c.isExpanded(id), "still open 1 s after looking away").toBe(true)
      await sleep(1300)
      expect(c.isExpanded(id), "collapsed about 2 s after looking away").toBe(false)
      expect(t.object("RankChip " + id).enabled, "chip back after collapse").toBe(true)
    } finally {
      t.releaseGaze()
    }
  }
}
