import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LAPTOP, PHONE, ROUTER, USB, VolatileSupport} from "./VolatileSupport"

/**
 * Done criterion 3: assessing in the order router, phone, laptop, USB re-sorts the chips each
 * time: Router #1; then Phone #1, Router #2; then Laptop #1, Phone #2, Router #3; then USB #4.
 * Each chip shows a one-line reason. The router shows "DON'T LOG IN" and the phone shows a
 * "Locked for at least" clock counting up.
 */
@component
export class RankingScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileSupport()
    const v = t.view
    const marker = (id: string) => v.getDrawn(id).marker

    try {
      await t.start()

      // Router first: #1 among the assessed devices. The others still show "?".
      await t.answerAll(ROUTER, ["On"])
      expect(marker(ROUTER), "router is #1").toBe("1")
      expect(marker(PHONE), "phone not assessed yet").toBe("?")
      expect(marker(LAPTOP), "laptop not assessed yet").toBe("?")
      expect(marker(USB), "USB not assessed yet").toBe("?")

      // Its card is open, so its "never do" strip is on the device.
      const routerStrip = v.getDrawn(ROUTER).strip
      expect(routerStrip !== null && routerStrip.indexOf("DON'T LOG IN") === 0, 'router strip says "DON\'T LOG IN"').toBe(true)

      // Phone, on and locked: takes #1, the router drops to #2.
      await t.answerAll(PHONE, ["On", "Locked", "No"])
      expect(marker(PHONE), "phone is #1").toBe("1")
      expect(marker(ROUTER), "router is #2").toBe("2")

      // Laptop, on and unlocked: takes #1.
      await t.answerAll(LAPTOP, ["On", "Unlocked", "No"])
      expect(marker(LAPTOP), "laptop is #1").toBe("1")
      expect(marker(PHONE), "phone is #2").toBe("2")
      expect(marker(ROUTER), "router is #3").toBe("3")
      expect(marker(USB), "USB still not assessed").toBe("?")

      // USB drive, plugged in: #4.
      await t.answerAll(USB, ["Plugged into a running machine"])
      expect(marker(LAPTOP), "laptop stays #1").toBe("1")
      expect(marker(PHONE), "phone stays #2").toBe("2")
      expect(marker(ROUTER), "router stays #3").toBe("3")
      expect(marker(USB), "USB is #4").toBe("4")
      const ranking = v.getRanking().map((r) => r.deviceId).join(",")
      expect(ranking, "engine ranking").toBe([LAPTOP, PHONE, ROUTER, USB].join(","))

      // With every card closed, each chip carries a one-line reason in the pill beside it.
      await t.lookAway()
      for (const id of [LAPTOP, PHONE, ROUTER, USB]) {
        const pill = v.getDrawn(id).pill
        expect(pill !== null && pill.length > 0, id + " shows a reason").toBe(true)
        expect(pill, id + " reason matches the rules").toBe(v.getDevice(id).reason)
        expect(t.object("ReasonPill " + id).enabled, id + " reason pill visible").toBe(true)
      }

      // The phone's clock shows in its pill and counts up.
      const first = v.getDrawn(PHONE).pillClock
      expect(first !== null && first.indexOf("Locked for at least") === 0, 'phone pill shows "Locked for at least"').toBe(true)
      const before = v.getDevice(PHONE).clockSeconds
      await sleep(1300)
      const after = v.getDevice(PHONE).clockSeconds
      expect(after > before, "phone clock counts up").toBe(true)
      expect(v.getDrawn(PHONE).pillClock !== first, "the drawn clock changed").toBe(true)
      expect(v.getDrawn(LAPTOP).pillClock, "the laptop has no clock").toBe(null)
    } finally {
      t.releaseGaze()
    }
  }
}
