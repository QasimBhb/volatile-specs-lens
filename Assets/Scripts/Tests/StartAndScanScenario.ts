import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DEVICE_IDS, VolatileSupport} from "./VolatileSupport"

/**
 * Done criterion 1: on start, the desk shows the scan prompt, all four stand-ins show a grey
 * "?" chip, and no cards are open. Pinching "I've scanned" hides the prompt and adds one log
 * entry.
 */
@component
export class StartAndScanScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileSupport()
    const v = t.view
    try {
      await t.start()

      expect(v.getDeviceIds().length, "device count").toBe(4)
      expect(v.isScanPromptVisible(), "scan prompt showing at start").toBe(true)
      expect(t.object("ScanPrompt").enabled, "scan prompt object enabled").toBe(true)
      expect(v.getOpenCardId(), "no card open").toBe(null)
      expect(v.isBannerVisible(), "banner hidden at start").toBe(false)
      expect(v.isLogOpen(), "log closed at start").toBe(false)
      expect(v.getLog().length, "log empty at start").toBe(0)

      for (const id of DEVICE_IDS) {
        const drawn = v.getDrawn(id)
        expect(drawn.marker, id + " chip shows ?").toBe("?")
        expect(drawn.markerChecked, id + " chip not checked").toBe(false)
        expect(drawn.pill, id + " has no reason pill").toBe(null)
        expect(drawn.strip, id + " has no strip").toBe(null)
        expect(v.getDevice(id).chip, id + " chip status").toBe("unassessed")
        expect(v.getDevice(id).rank, id + " has no rank").toBe(null)
        expect(t.object("RankMarker " + id).enabled, id + " marker visible").toBe(true)
        expect(t.object("Card " + id).enabled, id + " card closed").toBe(false)
      }

      // Pinch the real "I've scanned" button.
      await t.pinch("ScanButton")

      expect(v.isScanConfirmed(), "scan confirmed").toBe(true)
      expect(v.isScanPromptVisible(), "scan prompt hidden after the pinch").toBe(false)
      const log = v.getLog()
      expect(log.length, "exactly one log entry").toBe(1)
      expect(log[0].kind, "the entry is the scan").toBe("scan")
      expect(log[0].deviceId, "the scan entry has no device").toBe("")
    } finally {
      t.releaseGaze()
    }
  }
}
