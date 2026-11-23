import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {LAPTOP, PHONE, VolatileSupport} from "./VolatileSupport"

/**
 * Done criterion 5: pinching the scenario toggle moves the laptop's network step to step 2
 * with the ransomware text, and pinching Reassess on the phone reopens its questions. The
 * toggle adds one log entry when pinched; Reassess adds one when its questions are answered.
 */
@component
export class ScenarioAndReassessScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileSupport()
    const v = t.view
    try {
      await t.start()
      await t.assessDemoRun()

      // Laptop: finish the first two steps. In a criminal seizure the network step is last.
      await t.answerAll(LAPTOP, ["Normal", "Yes"])
      const before = v.getDevice(LAPTOP)
      expect(before.steps.length, "laptop has four steps").toBe(4)
      expect(before.steps[3].id, "network step is step 4 in a criminal seizure").toBe("network")
      expect(before.activeStep, "step 3 is active").toBe(2)
      expect(v.getScenario(), "starts on criminal seizure").toBe("criminal")
      expect(v.getScenarioToggleLabel(), "toggle shows the current scenario").toBe("Criminal seizure")

      // Pinch the real scenario toggle: one log entry.
      const logBeforeToggle = v.getLog().length
      await t.pinch("ScenarioToggle")
      expect(v.getScenario(), "scenario switched").toBe("ransomware")
      expect(v.getScenarioToggleLabel(), "toggle shows the new scenario").toBe("Ransomware response")
      const logAfterToggle = v.getLog()
      expect(logAfterToggle.length, "the toggle added exactly one log entry").toBe(logBeforeToggle + 1)
      expect(logAfterToggle[logAfterToggle.length - 1].kind, "the entry is the scenario switch").toBe("scenario")
      expect(logAfterToggle[logAfterToggle.length - 1].deviceId, "the scenario entry has no device").toBe("")

      // The network step is now step 2, with the ransomware text, and it is the active step.
      const after = v.getDevice(LAPTOP)
      expect(after.steps[1].id, "network step moved to position 2").toBe("network")
      expect(after.steps[1].number, "it is numbered 2").toBe(2)
      expect(after.steps[1].text.indexOf("Isolate from the network now") === 0, "it carries the ransomware text").toBe(true)
      expect(after.activeStep, "the network step is active").toBe(1)
      expect(after.steps[0].status, "step 1 stays done").toBe("done")
      expect(after.steps[2].status, "the step done earlier stays done, now at position 3").toBe("done")
      expect(after.steps[3].status, "the last step is locked behind the network step").toBe("locked")

      // And that is what the open card draws.
      const card = v.getDrawn(LAPTOP)
      expect(card.cardText[1].indexOf("2. Isolate from the network now") === 0, "card shows the ransomware step at 2").toBe(true)
      expect(card.sourceChip, "its source chip").toBe("CISA 2023")
      expect(card.buttons !== null && card.buttons[0] === "Yes" && card.buttons[1] === "Can't", "its fact buttons").toBe(true)
      expect(card.cardText[2].indexOf("✓") === 0, "step 3 is drawn as done").toBe(true)

      // Phone: Reassess reopens the questions. Nothing is logged until they are answered.
      await t.lookAt(PHONE)
      expect(v.getDrawn(PHONE).reassess, "Reassess button shows on the phone's card").toBe(true)
      const rankBefore = v.getDevice(PHONE).rank
      const logBeforeReassess = v.getLog().length
      await t.pinch("Reassess " + PHONE)
      expect(v.getDevice(PHONE).question !== null, "the phone's questions are open again").toBe(true)
      expect(v.getDrawn(PHONE).cardHeader, "card header while reassessing").toBe("PH-01 | REASSESSING")
      expect(v.getDrawn(PHONE).cardText.length, "the card shows one question").toBe(1)
      expect(v.getLog().length, "pinching Reassess logs nothing").toBe(logBeforeReassess)
      expect(v.getDevice(PHONE).stateId, "the old state is kept meanwhile").toBe("phone.on.locked")
      expect(v.getDevice(PHONE).rank, "the old rank is kept meanwhile").toBe(rankBefore)

      await t.answer(PHONE, "On")
      await t.answer(PHONE, "Locked")
      expect(v.getLog().length, "still nothing logged with one question left").toBe(logBeforeReassess)
      await t.answer(PHONE, "No")

      const logAfterReassess = v.getLog()
      expect(logAfterReassess.length, "answering the questions added exactly one log entry").toBe(logBeforeReassess + 1)
      const entry = logAfterReassess[logAfterReassess.length - 1]
      expect(entry.kind, "the entry is the reassessment").toBe("reassessed")
      expect(entry.deviceId, "it belongs to the phone").toBe(PHONE)
      expect(entry.text.indexOf("Reassessed:") === 0, "it records the old and new state").toBe(true)
      expect(v.getDevice(PHONE).question, "the questions are closed").toBe(null)
      expect(v.getDrawn(PHONE).cardHeader, "the card shows the steps again").toBe("PH-01 | ON · LOCKED")
    } finally {
      t.releaseGaze()
    }
  }
}
