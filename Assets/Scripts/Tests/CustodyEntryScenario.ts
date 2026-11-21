import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DEVICES} from "../VolatileData"
import {DEVICE_IDS, VolatileTestSupport} from "./VolatileTestSupport"

/**
 * Done criterion 4: each Done adds exactly one custody entry with the time, device ID and
 * action. It shows at the bottom of the stack and in the list opened from the Log chip.
 */
@component
export class CustodyEntryScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileTestSupport()
    const c = t.controller
    await t.waitReady()

    const id = DEVICE_IDS.find((d) => c.getActiveStepIndex(d) >= 0)
    if (!id) throw new Error("Every step is already done. Reset the preview and run again.")
    const def = DEVICES.find((d) => d.id === id)

    try {
      await t.lookAt(id)
      const stepIndex = c.getActiveStepIndex(id)
      const expectedAction = def.steps[stepIndex].logged
      const before = c.getCustodyLog().length
      const clockBefore = new Date()

      await t.pinchDone(id)

      // Exactly one new entry.
      const log = c.getCustodyLog()
      expect(log.length, "exactly one custody entry per Done").toBe(before + 1)
      const entry = log[log.length - 1]

      // Time: real clock time at the moment of the pinch, as HH:MM:SS.
      expect(/^\d\d:\d\d:\d\d$/.test(entry.time), "time is HH:MM:SS, got " + entry.time).toBe(true)
      const parts = entry.time.split(":").map((p) => parseInt(p, 10))
      const entrySeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
      const nowSeconds = clockBefore.getHours() * 3600 + clockBefore.getMinutes() * 60 + clockBefore.getSeconds()
      const drift = Math.abs(entrySeconds - nowSeconds)
      expect(drift <= 5 || drift >= 86395, "time is the real clock time of the pinch").toBe(true)

      // Device ID and action.
      expect(entry.deviceId, "device ID").toBe(id)
      expect(entry.action, "action").toBe(expectedAction)

      // Shown at the bottom of the stack.
      const line = t.textOf("CustodyLine " + id)
      expect(line, "custody line text").toBe(entry.line)
      expect(line.includes(entry.time) && line.includes(id) && line.includes(expectedAction), "custody line has time, device ID and action").toBe(true)
      expect(t.object("CustodyLine " + id).isEnabledInHierarchy, "custody line visible in the stack").toBe(true)
      const lineY = t.object("CustodyLine " + id).getTransform().getLocalPosition().y
      for (let n = 1; n <= c.getStepCount(id); n++) {
        expect(lineY < t.stepRow(id, n).getTransform().getLocalPosition().y, "custody line is below step " + n).toBe(true)
      }

      // Shown in the list opened from the Log chip on the desk.
      if (c.isLogOpen()) await t.pinchLogChip()
      expect(t.object("CustodyLog").enabled, "log list hidden before pinching the Log chip").toBe(false)
      await t.pinchLogChip()
      expect(c.isLogOpen(), "log open after pinching the Log chip").toBe(true)
      expect(t.object("CustodyLog").enabled, "log list visible").toBe(true)
      const listLines = t.textOf("CustodyLog", "Log Entries").split("\n")
      expect(listLines.length, "list has every entry").toBe(before + 1)
      const last = listLines[listLines.length - 1]
      expect(last.includes(entry.time) && last.includes(id) && last.includes(expectedAction), "list row has time, device ID and action").toBe(true)

      // Pinching the chip again hides the list.
      await t.pinchLogChip()
      expect(t.object("CustodyLog").enabled, "log list hidden after second pinch").toBe(false)
    } finally {
      t.releaseGaze()
    }
  }
}
