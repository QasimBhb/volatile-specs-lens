import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {LAPTOP, ROUTER, VolatileSupport} from "./VolatileSupport"

/**
 * Done criterion 2: looking at a stand-in for about 1 second traces a ring, then opens its
 * question card. The laptop gets three questions, the router one.
 */
@component
export class GazeQuestionsScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileSupport()
    const v = t.view
    try {
      await t.start()

      expect(v.hasRingTraced(LAPTOP), "laptop ring has not traced before gaze").toBe(false)
      expect(v.isCardOpen(LAPTOP), "laptop card closed before gaze").toBe(false)
      expect(v.hasRingTraced(ROUTER), "router ring has not traced before gaze").toBe(false)
      expect(v.isCardOpen(ROUTER), "router card closed before gaze").toBe(false)

      // Dwell on the laptop (~1 s): ring traces, then its question card opens.
      await t.lookAt(LAPTOP)
      expect(v.hasRingTraced(LAPTOP), "laptop scan ring traced after gaze dwell").toBe(true)
      expect(v.isCardOpen(LAPTOP), "laptop card opened after ring").toBe(true)
      expect(v.getOpenCardId(), "open card is laptop").toBe(LAPTOP)
      expect(t.object("Card " + LAPTOP).enabled, "laptop card object enabled").toBe(true)
      expect(v.getDrawn(LAPTOP).cardHeader, "unassessed laptop header").toBe("LAP-01 | NOT ASSESSED")
      expect(v.getDrawn(LAPTOP).strip, "unassessed laptop has no strip yet").toBe(null)

      // Count and answer the laptop's three state questions by pinching real buttons.
      let laptopQuestions = 0

      const q1 = v.getDrawn(LAPTOP)
      expect(q1.cardText.length, "laptop Q1 shows one question stem").toBe(1)
      expect(q1.cardText[0].length > 0, "laptop Q1 stem non-empty").toBe(true)
      expect(q1.buttons !== null && q1.buttons[0] === "On" && q1.buttons[1] === "Off", "laptop Q1 buttons On / Off").toBe(true)
      laptopQuestions++
      await t.answer(LAPTOP, "On")

      const q2 = v.getDrawn(LAPTOP)
      expect(q2.cardHeader, "laptop Q2 still NOT ASSESSED").toBe("LAP-01 | NOT ASSESSED")
      expect(q2.cardText.length, "laptop Q2 shows one question stem").toBe(1)
      expect(q2.cardText[0] !== q1.cardText[0], "laptop Q2 stem advanced").toBe(true)
      expect(q2.buttons !== null && q2.buttons[0] === "Locked" && q2.buttons[1] === "Unlocked", "laptop Q2 buttons Locked / Unlocked").toBe(true)
      laptopQuestions++
      await t.answer(LAPTOP, "Unlocked")

      const q3 = v.getDrawn(LAPTOP)
      expect(q3.cardHeader, "laptop Q3 still NOT ASSESSED").toBe("LAP-01 | NOT ASSESSED")
      expect(q3.cardText.length, "laptop Q3 shows one question stem").toBe(1)
      expect(q3.cardText[0], "laptop Q3 asks Being wiped?").toBe("Being wiped?")
      expect(q3.buttons !== null && q3.buttons[0] === "Yes" && q3.buttons[1] === "No", "laptop Q3 buttons Yes / No").toBe(true)
      laptopQuestions++
      await t.answer(LAPTOP, "No")

      expect(laptopQuestions, "laptop asked three questions").toBe(3)
      expect(v.getDevice(LAPTOP).question, "laptop question tree finished").toBe(null)
      expect(v.getDevice(LAPTOP).stateId, "laptop assessed as unlocked").toBe("laptop.on.unlocked")
      expect(v.getDrawn(LAPTOP).cardHeader, "laptop card now shows assessed state").toBe("LAP-01 | ON · UNLOCKED")
      expect(v.getDrawn(LAPTOP).cardText.length, "laptop step card shows 4 steps").toBe(4)

      // Dwell on the router (~1 s): ring traces, laptop card closes, router asks one question.
      expect(v.hasRingTraced(ROUTER), "router ring still untraced before gaze").toBe(false)
      await t.lookAt(ROUTER)
      expect(v.hasRingTraced(ROUTER), "router scan ring traced after gaze dwell").toBe(true)
      expect(v.isCardOpen(ROUTER), "router card opened after ring").toBe(true)
      expect(v.isCardOpen(LAPTOP), "looking at router closed laptop card").toBe(false)

      let routerQuestions = 0
      const rq1 = v.getDrawn(ROUTER)
      expect(rq1.cardHeader, "unassessed router header").toBe("NET-01 | NOT ASSESSED")
      expect(rq1.cardText.length, "router Q1 shows one question stem").toBe(1)
      expect(rq1.cardText[0].length > 0, "router Q1 stem non-empty").toBe(true)
      expect(rq1.buttons !== null && rq1.buttons[0] === "On" && rq1.buttons[1] === "Off", "router Q1 buttons On / Off").toBe(true)
      routerQuestions++
      await t.answer(ROUTER, "On")

      expect(routerQuestions, "router asked one question").toBe(1)
      expect(v.getDevice(ROUTER).question, "router question tree finished").toBe(null)
      expect(v.getDevice(ROUTER).stateId, "router assessed as on").toBe("router.on")
      expect(v.getDrawn(ROUTER).cardText.length, "router step card shows 3 steps").toBe(3)
    } finally {
      t.releaseGaze()
    }
  }
}
