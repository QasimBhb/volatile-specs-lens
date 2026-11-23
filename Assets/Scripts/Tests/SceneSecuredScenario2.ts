import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {LAPTOP, PHONE, ROUTER, USB, VolatileSupport} from "./VolatileSupport"

/**
 * Done criterion 6: finishing every step on all four devices shows the green "Scene secured"
 * banner with the total time.
 */
@component
export class SceneSecuredScenario2 extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileSupport()
    const v = t.view
    try {
      await t.start()

      expect(v.isSceneSecured(), "scene not secured at start").toBe(false)
      expect(v.isBannerVisible(), "banner hidden at start").toBe(false)
      expect(t.object("SceneSecuredBanner").enabled, "banner object disabled at start").toBe(false)
      expect(v.getBannerText(), "banner text empty at start").toBe("")

      // Assess all four devices in demo order (router, phone, laptop, USB drive).
      await t.assessDemoRun()
      expect(v.isSceneSecured(), "not secured right after assessment").toBe(false)
      expect(v.isBannerVisible(), "banner hidden after assessment").toBe(false)

      // Finish #1 Laptop (on, unlocked, not wiping).
      await t.answerAll(LAPTOP, ["Normal", "Yes", "Coming", "Left on"])
      expect(v.getDevice(LAPTOP).chip, "laptop done").toBe("done")
      expect(v.getDrawn(LAPTOP).markerChecked, "laptop marker checked").toBe(true)
      expect(v.isSceneSecured(), "not secured after 1 device").toBe(false)

      // Finish #2 Phone (on, locked, not wiping).
      await t.answerAll(PHONE, ["Lock screen", "Connected", "None", "Done"])
      expect(v.getDevice(PHONE).chip, "phone done").toBe("done")
      expect(v.getDrawn(PHONE).markerChecked, "phone marker checked").toBe(true)
      expect(v.isSceneSecured(), "not secured after 2 devices").toBe(false)

      // Finish #3 Router (on).
      await t.answerAll(ROUTER, ["Blinking", "Recorded", "Flagged"])
      expect(v.getDevice(ROUTER).chip, "router done").toBe("done")
      expect(v.getDrawn(ROUTER).markerChecked, "router marker checked").toBe(true)
      expect(v.isSceneSecured(), "not secured after 3 devices").toBe(false)
      expect(v.isBannerVisible(), "banner still hidden before 4th device finishes").toBe(false)

      // Finish #4 USB drive (plugged into a running machine), verifying banner waits for final step.
      await t.lookAt(USB)
      await t.answer(USB, "Blinking")
      await t.answer(USB, "Both")
      await t.answer(USB, "Made")
      expect(v.isSceneSecured(), "not secured with final USB step open").toBe(false)
      expect(v.isBannerVisible(), "banner still hidden before final pinch").toBe(false)

      await t.answer(USB, "Bagged")
      expect(v.getDevice(USB).chip, "USB done").toBe("done")
      expect(v.getDrawn(USB).markerChecked, "USB marker checked").toBe(true)

      expect(v.isSceneSecured(), "scene secured once all four devices finish").toBe(true)
      expect(v.isBannerVisible(), "Scene secured banner visible").toBe(true)
      expect(t.object("SceneSecuredBanner").enabled, "SceneSecuredBanner object enabled").toBe(true)

      const bannerText = v.getBannerText()
      expect(/^Scene secured, total time \d{2}:\d{2}$/.test(bannerText), "banner shows Scene secured and MM:SS total time").toBe(true)
    } finally {
      t.releaseGaze()
    }
  }
}
