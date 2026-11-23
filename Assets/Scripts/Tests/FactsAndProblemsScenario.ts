import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {PHONE, ROUTER, VolatileSupport} from "./VolatileSupport"

/**
 * Done criterion 4: steps complete only in order, each by a fact button, and every fact-button
 * pinch adds exactly one custody entry (time, device ID, action, fact) on the card and in the
 * Log list. The active step shows its source chip. Answering "Signal in bag: Still showing" on
 * the phone or "Expert: Not yet" on the router keeps that step open with a corrective line.
 */
@component
export class FactsAndProblemsScenario extends Scenario {
  async run(): Promise<void> {
    const t = new VolatileSupport()
    const v = t.view
    try {
      await t.start()

      // Assess router (on): 1 assessed log entry; step 1 is active, steps 2 and 3 locked.
      await t.answerAll(ROUTER, ["On"])
      expect(v.getLog().length, "1 entry after router assessment").toBe(1)
      expect(v.getDevice(ROUTER).activeStep, "router starts at step 1").toBe(0)
      expect(v.getDevice(ROUTER).steps[1].status, "router step 2 locked").toBe("locked")
      expect(v.getDevice(ROUTER).steps[2].status, "router step 3 locked").toBe("locked")
      expect(v.getDrawn(ROUTER).sourceChip, "router step 1 source chip").toBe("Inferred")

      // Router step 1 -> adds 1 custody entry, marks step 1 done, opens step 2.
      await t.answer(ROUTER, "Blinking")
      expect(v.getLog().length, "router step 1 added 1 log entry").toBe(2)
      const rLog1 = v.getLog()[1]
      expect(rLog1.kind, "router step 1 log kind").toBe("fact")
      expect(rLog1.deviceId, "router step 1 log device").toBe(ROUTER)
      expect(rLog1.text, "router step 1 log fact").toBe("Lights: Blinking")
      expect(rLog1.time.length, "router step 1 timestamp HH:MM:SS").toBe(8)
      const rCustody1 = v.getDrawn(ROUTER).custody
      expect(rCustody1 !== null && rCustody1.indexOf(ROUTER) >= 0 && rCustody1.indexOf("Lights: Blinking") >= 0, "card custody shows router step 1 fact").toBe(true)
      expect(v.getDrawn(ROUTER).cardText[0].indexOf("✓") === 0, "router step 1 checked done").toBe(true)
      expect(v.getDevice(ROUTER).activeStep, "router advanced to step 2").toBe(1)
      expect(v.getDrawn(ROUTER).sourceChip, "router step 2 source chip").toBe("NIJ 2008")

      // Router step 2 -> adds 1 custody entry, opens step 3.
      await t.answer(ROUTER, "Recorded")
      expect(v.getLog().length, "router step 2 added 1 log entry").toBe(3)
      expect(v.getDevice(ROUTER).activeStep, "router advanced to step 3").toBe(2)
      expect(v.getDrawn(ROUTER).sourceChip, "router step 3 source chip").toBe("Inferred")

      // Router step 3 problem ("Expert: Not yet"): logs 1 entry, stays open with corrective line.
      await t.answer(ROUTER, "Not yet")
      expect(v.getLog().length, "router problem answer added 1 log entry").toBe(4)
      expect(v.getLog()[3].text, "router problem logged").toBe("Expert: Not yet")
      expect(v.getDevice(ROUTER).activeStep, "router step 3 stays active").toBe(2)
      expect(v.getDevice(ROUTER).steps[2].problemOpen, "router step 3 problemOpen").toBe(true)
      expect(v.getDrawn(ROUTER).cardText[2], "router step 3 corrective line").toBe("3. Flag it before you leave the room.")
      const rCustodyProb = v.getDrawn(ROUTER).custody
      expect(rCustodyProb !== null && rCustodyProb.indexOf("Expert: Not yet") >= 0, "card custody shows router problem fact").toBe(true)

      // Closing router step 3 ("Flagged") finishes the router.
      await t.answer(ROUTER, "Flagged")
      expect(v.getLog().length, "router closing answer added 1 log entry").toBe(5)
      expect(v.getDevice(ROUTER).chip, "router finished").toBe("done")
      expect(v.getDrawn(ROUTER).markerChecked, "router marker checked").toBe(true)

      // Assess phone (on, locked, not wiping) and advance in order to step 3 ("Signal in bag:").
      await t.answerAll(PHONE, ["On", "Locked", "No"])
      expect(v.getLog().length, "phone assessment added 1 log entry").toBe(6)
      expect(v.getDrawn(PHONE).sourceChip, "phone step 1 source chip").toBe("SWGDE 2025")

      await t.answer(PHONE, "Lock screen")
      expect(v.getLog().length, "phone step 1 added 1 log entry").toBe(7)
      expect(v.getDrawn(PHONE).cardText[0].indexOf("✓") === 0, "phone step 1 checked done").toBe(true)
      expect(v.getDevice(PHONE).activeStep, "phone advanced to step 2").toBe(1)

      await t.answer(PHONE, "Connected")
      expect(v.getLog().length, "phone step 2 added 1 log entry").toBe(8)
      expect(v.getDrawn(PHONE).cardText[1].indexOf("✓") === 0, "phone step 2 checked done").toBe(true)
      expect(v.getDevice(PHONE).activeStep, "phone advanced to step 3").toBe(2)
      expect(v.getDrawn(PHONE).sourceChip, "phone step 3 source chip").toBe("SWGDE 2025")

      // Phone step 3 problem ("Signal in bag: Still showing"): stays open with corrective line.
      await t.answer(PHONE, "Still showing")
      expect(v.getLog().length, "phone problem answer added 1 log entry").toBe(9)
      const pLogProb = v.getLog()[8]
      expect(pLogProb.deviceId, "phone problem log device").toBe(PHONE)
      expect(pLogProb.text, "phone problem log text").toBe("Signal in bag: Still showing")
      expect(v.getDevice(PHONE).activeStep, "phone step 3 stays active").toBe(2)
      expect(v.getDevice(PHONE).steps[2].problemOpen, "phone step 3 problemOpen").toBe(true)
      expect(v.getDrawn(PHONE).cardText[2], "phone step 3 corrective line").toBe("3. Reseal or change the bag.")
      const pCustodyProb = v.getDrawn(PHONE).custody
      expect(pCustodyProb !== null && pCustodyProb.indexOf("Signal in bag: Still showing") >= 0, "phone card custody shows problem fact").toBe(true)

      // Resolving phone step 3 ("None") closes step 3 and opens step 4.
      await t.answer(PHONE, "None")
      expect(v.getLog().length, "phone step 3 resolution added 1 log entry").toBe(10)
      expect(v.getDevice(PHONE).steps[2].status, "phone step 3 done").toBe("done")
      expect(v.getDevice(PHONE).steps[2].problemOpen, "phone step 3 problem cleared").toBe(false)
      expect(v.getDevice(PHONE).activeStep, "phone advanced to step 4").toBe(3)

      // Pinch LogChip to open the CustodyLog list and verify all 10 entries are recorded.
      expect(v.isLogOpen(), "log closed before pinch").toBe(false)
      await t.pinch("LogChip")
      expect(v.isLogOpen(), "log opened after LogChip pinch").toBe(true)
      expect(t.object("CustodyLog").enabled, "CustodyLog object enabled").toBe(true)
      const fullLog = v.getLog()
      const listText = (t.object("Log Entries").getComponent("Component.Text") as Text).text
      expect(listText.indexOf("Signal in bag: None") >= 0, "the Log list draws the latest entry").toBe(true)
      expect(listText.indexOf("Signal in bag: Still showing") >= 0, "the Log list draws the problem answer").toBe(true)
      expect(fullLog.length, "10 total custody log entries").toBe(10)
      for (const entry of fullLog) {
        expect(entry.line.indexOf(entry.time) === 0 && entry.line.indexOf(entry.text) > 0, "formatted log line holds time and fact").toBe(true)
      }
    } finally {
      t.releaseGaze()
    }
  }
}
