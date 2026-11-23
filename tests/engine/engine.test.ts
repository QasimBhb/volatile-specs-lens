import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createEngine } from "../../Assets/Scripts/VolatileEngine"
import { VOLATILE_RULES } from "../../Assets/Scripts/VolatileRules"
import type {
  AnswerIndex,
  Clock,
  DeviceId,
  DeviceKind,
  DeviceView,
  EngineEvent,
  LogEntry,
  Rules,
  Scenario,
  StateId,
  VolatileEngine,
} from "../../Assets/Scripts/VolatileTypes"

type FakeClock = Clock & {
  advanceSeconds(seconds: number): void
  advanceMs(ms: number): void
  setTime(hhmmss: string): void
}

type EngineSnapshot = {
  deviceIds: DeviceId[]
  devices: DeviceView[]
  ranking: { deviceId: DeviceId; rank: number; reason: string }[]
  scenario: Scenario
  scanConfirmed: boolean
  log: LogEntry[]
  secured: boolean
  elapsed: number
}

function createFakeClock(startMs = 10_000, startSecondsOfDay = 14 * 3600 + 32 * 60): FakeClock {
  let currentMs = startMs
  let daySeconds = startSecondsOfDay
  let overrideTime: string | null = null

  function formatSeconds(totalSec: number): string {
    const wrapped = ((Math.floor(totalSec) % 86_400) + 86_400) % 86_400
    const hh = String(Math.floor(wrapped / 3600)).padStart(2, "0")
    const mm = String(Math.floor((wrapped % 3600) / 60)).padStart(2, "0")
    const ss = String(wrapped % 60).padStart(2, "0")
    return `${hh}:${mm}:${ss}`
  }

  return {
    nowMs(): number {
      return currentMs
    },
    timeString(): string {
      return overrideTime ?? formatSeconds(daySeconds)
    },
    advanceSeconds(seconds: number): void {
      currentMs += seconds * 1000
      daySeconds += seconds
      overrideTime = null
    },
    advanceMs(ms: number): void {
      currentMs += ms
      daySeconds += ms / 1000
      overrideTime = null
    },
    setTime(hhmmss: string): void {
      overrideTime = hhmmss
    },
  }
}

function makeSetup(customRules: Rules = VOLATILE_RULES): {
  engine: VolatileEngine
  clock: FakeClock
} {
  const clock = createFakeClock()
  const engine = createEngine(customRules, clock)
  return { engine, clock }
}

function snapshotEngine(engine: VolatileEngine): EngineSnapshot {
  const ids = engine.getDeviceIds()
  return {
    deviceIds: structuredClone(ids),
    devices: ids.map((id) => structuredClone(engine.getDevice(id))),
    ranking: structuredClone(engine.getRanking()),
    scenario: engine.getScenario(),
    scanConfirmed: engine.isScanConfirmed(),
    log: structuredClone(engine.getLog()),
    secured: engine.isSceneSecured(),
    elapsed: engine.getElapsedSeconds(),
  }
}

function assertDisallowedNoOp(engine: VolatileEngine, call: () => EngineEvent[]): void {
  const before = snapshotEngine(engine)
  const events = call()
  assert.deepEqual(events, [])
  assert.deepEqual(snapshotEngine(engine), before)
}

function assertLoggedPayloadMatchesTail(events: EngineEvent[], engine: VolatileEngine): void {
  const loggedEvents = events.filter((e) => e.type === "logged")
  assert.equal(loggedEvents.length, 1, "Expected exactly one logged event")
  const tail = engine.getLog().at(-1)
  assert.notEqual(tail, undefined)
  assert.deepEqual(loggedEvents[0], { type: "logged", entry: tail! })
}

const DEVICE_KINDS: Record<DeviceId, DeviceKind> = {
  "LAP-01": "laptop",
  "NET-01": "router",
  "PH-01": "phone",
  "USB-01": "usb",
}

/**
 * Answers a device's question tree to reach a target state, computing expected question IDs
 * directly from `rules` (not from the engine's own view).
 */
function assessToState(
  engine: VolatileEngine,
  id: DeviceId,
  answers: AnswerIndex[],
  rules: Rules = VOLATILE_RULES,
): EngineEvent[] {
  let currentQId = rules.firstQuestion[DEVICE_KINDS[id]]
  assert.equal(engine.getDevice(id).question?.id, currentQId)

  let lastEvents: EngineEvent[] = []
  for (let i = 0; i < answers.length; i++) {
    const qDef = rules.questions[currentQId]
    assert.notEqual(qDef, undefined, `Missing question ${currentQId} in rules`)
    const nextTarget = qDef.answers[answers[i]].next

    const logLenBefore = engine.getLog().length
    const events = engine.answerQuestion(id, answers[i])

    if (i < answers.length - 1) {
      assert.ok("question" in nextTarget, `Expected intermediate answer ${i + 1} to lead to a question`)
      const expectedNextQId = nextTarget.question
      assert.equal(engine.getLog().length, logLenBefore)
      assert.deepEqual(events, [
        { type: "question_asked", deviceId: id, questionId: expectedNextQId },
      ])
      assert.equal(engine.getDevice(id).question?.id, expectedNextQId)
      currentQId = expectedNextQId
    } else {
      assert.ok("state" in nextTarget, "Expected final answer to lead to a state")
      assert.equal(engine.getLog().length, logLenBefore + 1)
      assertLoggedPayloadMatchesTail(events, engine)
      lastEvents = events
    }
  }
  return lastEvents
}

const ANSWERS_FOR_STATE: Record<StateId, { deviceId: DeviceId; answers: AnswerIndex[] }> = {
  "laptop.on.unlocked": { deviceId: "LAP-01", answers: [0, 1, 1] },
  "laptop.on.locked": { deviceId: "LAP-01", answers: [0, 0, 1] },
  "laptop.off": { deviceId: "LAP-01", answers: [1] },
  "laptop.wiping": { deviceId: "LAP-01", answers: [0, 1, 0] },
  "router.on": { deviceId: "NET-01", answers: [0] },
  "router.off": { deviceId: "NET-01", answers: [1] },
  "phone.on.unlocked": { deviceId: "PH-01", answers: [0, 1, 1] },
  "phone.on.locked": { deviceId: "PH-01", answers: [0, 0, 1] },
  "phone.off": { deviceId: "PH-01", answers: [1] },
  "phone.wiping": { deviceId: "PH-01", answers: [0, 0, 0] },
  "usb.plugged": { deviceId: "USB-01", answers: [0] },
  "usb.loose": { deviceId: "USB-01", answers: [1] },
}

describe("Done Criterion 1: Start state, r2/r3 templates, defensive copies, and room scan", () => {
  it("exposes exact brief prompts, r2 templates, and four unassessed stand-in devices on start", () => {
    const { engine } = makeSetup()

    assert.equal(VOLATILE_RULES.text.scanPrompt, "Scan the room, trace the cables")
    assert.equal(VOLATILE_RULES.text.scanButton, "I've scanned")
    assert.equal(VOLATILE_RULES.text.sceneSecured, "Scene secured")
    assert.ok(VOLATILE_RULES.text.scanLogged.length > 0)
    assert.deepEqual(VOLATILE_RULES.text.scenarioLabels, {
      criminal: "Criminal seizure",
      ransomware: "Ransomware response",
    })
    assert.equal(VOLATILE_RULES.text.logAssessed, "Assessed: {state}")
    assert.equal(VOLATILE_RULES.text.logReassessed, "Reassessed: {from} to {to}")
    assert.equal(VOLATILE_RULES.text.logScenario, "Scenario: {scenario}")
    assert.equal(VOLATILE_RULES.text.nudge, "#{rank} {name} is still waiting")

    assert.equal(engine.getScenario(), "criminal")
    assert.equal(engine.isScanConfirmed(), false)
    assert.deepEqual(engine.getRanking(), [])
    assert.deepEqual(engine.getLog(), [])
    assert.equal(engine.isSceneSecured(), false)
    assert.equal(engine.getElapsedSeconds(), 0)

    const ids = engine.getDeviceIds()
    assert.equal(ids.length, 4)
    assert.deepEqual([...ids].sort(), ["LAP-01", "NET-01", "PH-01", "USB-01"])

    const expectedNames: Record<DeviceId, string> = {
      "LAP-01": "Laptop",
      "NET-01": "Router",
      "PH-01": "Phone",
      "USB-01": "USB drive",
    }

    for (const id of ids) {
      const view = engine.getDevice(id)
      assert.equal(view.id, id)
      assert.equal(view.name, expectedNames[id])
      assert.equal(view.chip, "unassessed")
      assert.equal(view.stateId, null)
      assert.equal(view.stateLabel, "")
      assert.equal(view.rank, null)
      assert.equal(view.reason, "")
      assert.equal(view.strip, null)
      assert.deepEqual(view.steps, [])
      assert.equal(view.activeStep, -1)
      assert.equal(view.nudge, null)
      assert.equal(view.clockSeconds, null)
      assert.equal(view.clockLabel, "")
      assert.equal(view.clockNote, "")
      assert.equal(view.question?.id, VOLATILE_RULES.firstQuestion[DEVICE_KINDS[id]])
    }
  })

  it("confirms room scan once with exact logged event payload, and ignores repeat calls without mutating state", () => {
    const { engine, clock } = makeSetup()
    clock.setTime("14:32:01")

    const events = engine.confirmScan()
    assert.equal(engine.isScanConfirmed(), true)
    assert.equal(events.length, 1)
    assertLoggedPayloadMatchesTail(events, engine)

    const log = engine.getLog()
    assert.equal(log.length, 1)
    assert.deepEqual(log[0], {
      kind: "scan",
      time: "14:32:01",
      deviceId: "",
      text: VOLATILE_RULES.text.scanLogged,
      line: `14:32:01, ${VOLATILE_RULES.text.scanLogged}`,
    })

    clock.setTime("14:32:05")
    assertDisallowedNoOp(engine, () => engine.confirmScan())
  })

  it("returns defensive copies from getLog(), getDevice(), getDeviceIds(), and getRanking() so caller mutations do not affect engine state", () => {
    const { engine, clock } = makeSetup()
    clock.setTime("14:32:01")
    engine.confirmScan()

    // Mutate unassessed question view
    const unassessedSnap = structuredClone(engine.getDevice("LAP-01"))
    const qMut = engine.getDevice("LAP-01")
    qMut.question!.answers[0] = "CORRUPTED_Q"
    assert.deepEqual(engine.getDevice("LAP-01"), unassessedSnap)

    assessToState(engine, "NET-01", [0])

    // Mutate getLog() array and entry fields
    const expectedLog = structuredClone(engine.getLog())
    const mutated = engine.getLog()
    mutated[0].text = "CORRUPTED"
    mutated[0].line = "CORRUPTED_LINE"
    mutated.push({
      kind: "scan",
      time: "99:99:99",
      deviceId: "",
      text: "FAKE",
      line: "99:99:99, FAKE",
    })
    assert.deepEqual(engine.getLog(), expectedLog)

    const emptied = engine.getLog()
    emptied.length = 0
    assert.deepEqual(engine.getLog(), expectedLog)

    // Mutate getDeviceIds(), getRanking(), and getDevice() nested arrays/objects
    const expectedIds = structuredClone(engine.getDeviceIds())
    engine.getDeviceIds().pop()
    assert.deepEqual(engine.getDeviceIds(), expectedIds)

    const expectedRanking = structuredClone(engine.getRanking())
    const rankMut = engine.getRanking()
    rankMut[0].rank = 99
    rankMut.pop()
    assert.deepEqual(engine.getRanking(), expectedRanking)

    const expectedNet = structuredClone(engine.getDevice("NET-01"))
    const devMut = engine.getDevice("NET-01")
    devMut.strip!.sources.push("FAKE_STRIP_SRC")
    devMut.steps[0].sources.push("FAKE_STEP_SRC")
    devMut.steps[0].fact!.answers[0] = "FAKE_ANS"
    devMut.steps.pop()
    assert.deepEqual(engine.getDevice("NET-01"), expectedNet)
  })

  it("holds no hardcoded wording in the engine (uses Rules.text templates exclusively)", () => {
    const customRules: Rules = {
      ...VOLATILE_RULES,
      text: {
        ...VOLATILE_RULES.text,
        scanLogged: "CUSTOM_SCAN",
        scenarioLabels: { criminal: "CRIM_LABEL", ransomware: "RANSOM_LABEL" },
        logAssessed: "ASSESS[{state}]",
        logReassessed: "REASSESS[{from}=>{to}]",
        logScenario: "MODE[{scenario}]",
        nudge: "WAIT({rank}:{name})",
      },
    }
    const { engine, clock } = makeSetup(customRules)
    clock.setTime("10:00:00")

    const scanEv = engine.confirmScan()
    assertLoggedPayloadMatchesTail(scanEv, engine)
    assert.equal(engine.getLog().at(-1)?.line, "10:00:00, CUSTOM_SCAN")

    const scenEv = engine.setScenario("ransomware")
    assertLoggedPayloadMatchesTail(scenEv, engine)
    assert.equal(engine.getLog().at(-1)?.line, "10:00:00, MODE[RANSOM_LABEL]")

    assessToState(engine, "PH-01", [0, 1, 1], customRules)
    assert.equal(
      engine.getLog().at(-1)?.text,
      `ASSESS[${VOLATILE_RULES.states["phone.on.unlocked"].logLabel}]`,
    )

    assessToState(engine, "NET-01", [0], customRules)
    assert.equal(engine.getDevice("NET-01").nudge, "WAIT(1:Phone)")

    engine.beginReassess("PH-01")
    assessToState(engine, "PH-01", [0, 0, 1], customRules)
    assert.equal(engine.getLog().at(-1)?.text, "REASSESS[unlocked=>locked]")
  })
})

describe("Done Criterion 2: Per-device question trees and all 12 states", () => {
  it("emits question_asked with rule-derived IDs, skips to off when Off is answered, and emits [logged, assessed, ranks_changed] on completion", () => {
    const { engine, clock } = makeSetup()
    clock.setTime("14:32:10")

    const expectedQ1Id = VOLATILE_RULES.firstQuestion.laptop
    const q1Def = VOLATILE_RULES.questions[expectedQ1Id]
    const expectedQ2Id = ("question" in q1Def.answers[0].next && q1Def.answers[0].next.question) || ""
    const q2Def = VOLATILE_RULES.questions[expectedQ2Id]
    const expectedQ3Id = ("question" in q2Def.answers[1].next && q2Def.answers[1].next.question) || ""

    const lapQ1 = engine.getDevice("LAP-01").question
    assert.equal(lapQ1?.id, expectedQ1Id)
    assert.deepEqual(lapQ1?.answers, ["On", "Off"])

    const ev1 = engine.answerQuestion("LAP-01", 0)
    assert.equal(engine.getLog().length, 0)
    assert.deepEqual(ev1, [{ type: "question_asked", deviceId: "LAP-01", questionId: expectedQ2Id }])
    assert.deepEqual(engine.getDevice("LAP-01").question?.answers, ["Locked", "Unlocked"])

    const ev2 = engine.answerQuestion("LAP-01", 1)
    assert.equal(engine.getLog().length, 0)
    assert.deepEqual(ev2, [{ type: "question_asked", deviceId: "LAP-01", questionId: expectedQ3Id }])
    assert.equal(engine.getDevice("LAP-01").question?.stem, "Being wiped?")
    assert.deepEqual(engine.getDevice("LAP-01").question?.answers, ["Yes", "No"])

    const lapFinishEvents = engine.answerQuestion("LAP-01", 1)
    assert.equal(engine.getDevice("LAP-01").question, null)
    assert.equal(engine.getDevice("LAP-01").stateId, "laptop.on.unlocked")
    assert.equal(engine.getDevice("LAP-01").chip, "assessed")
    assertLoggedPayloadMatchesTail(lapFinishEvents, engine)
    assert.deepEqual(
      lapFinishEvents.map((e) => e.type),
      ["logged", "assessed", "ranks_changed"],
    )
    assert.deepEqual(lapFinishEvents[1], {
      type: "assessed",
      deviceId: "LAP-01",
      state: "laptop.on.unlocked",
      reassessed: false,
    })

    // Phone: Off (1) skips remaining questions immediately
    const phEvents = engine.answerQuestion("PH-01", 1)
    assertLoggedPayloadMatchesTail(phEvents, engine)
    assert.deepEqual(
      phEvents.map((e) => e.type),
      ["logged", "assessed", "ranks_changed"],
    )
    assert.equal(engine.getDevice("PH-01").question, null)
    assert.equal(engine.getDevice("PH-01").stateId, "phone.off")

    // Router: 1 question (On / Off)
    engine.answerQuestion("NET-01", 0)
    assert.equal(engine.getDevice("NET-01").question, null)
    assert.equal(engine.getDevice("NET-01").stateId, "router.on")

    // USB: 1 question (Plugged into a running machine / Loose)
    engine.answerQuestion("USB-01", 0)
    assert.equal(engine.getDevice("USB-01").question, null)
    assert.equal(engine.getDevice("USB-01").stateId, "usb.plugged")
  })

  it("reaches all 12 states with exact brief reason lines, strips, shortLabels, sources, and assessed log entries", () => {
    const expectedMeta: Record<
      StateId,
      { reason: string; stripText: string; stripSources: string[]; shortLabel: string }
    > = {
      "laptop.on.unlocked": {
        reason: "on and unlocked, could lock",
        stripText: "DON'T SHUT DOWN. DON'T TYPE OR CLICK.",
        stripSources: ["NIJ 2008", "INTERPOL 2021"],
        shortLabel: "unlocked",
      },
      "laptop.on.locked": {
        reason: "locked but live, keep it powered",
        stripText: "DON'T SHUT DOWN OR RESTART. DON'T TYPE.",
        stripSources: ["NIJ 2008", "ACPO 2012"],
        shortLabel: "locked",
      },
      "laptop.off": {
        reason: "stable, can wait",
        stripText: "DON'T SWITCH IT ON.",
        stripSources: ["NIJ 2008", "ACPO 2012"],
        shortLabel: "off",
      },
      "laptop.wiping": {
        reason: "wiping now, act first",
        stripText: "ACT NOW.",
        stripSources: ["NIJ 2008", "INTERPOL 2021"],
        shortLabel: "wiping",
      },
      "router.on": {
        reason: "leave on, call an expert",
        stripText: "DON'T LOG IN.",
        stripSources: ["ACPO 2012"],
        shortLabel: "on",
      },
      "router.off": {
        reason: "stable, can wait",
        stripText: "DON'T SWITCH IT ON.",
        stripSources: ["Inferred"],
        shortLabel: "off",
      },
      "phone.on.unlocked": {
        reason: "on and unlocked, could lock",
        stripText: "DON'T LET IT LOCK.",
        stripSources: ["SWGDE 2025"],
        shortLabel: "unlocked",
      },
      "phone.on.locked": {
        reason: "locked, could reboot or be wiped",
        stripText: "DON'T GUESS THE PASSCODE.",
        stripSources: ["SWGDE 2025"],
        shortLabel: "locked",
      },
      "phone.off": {
        reason: "stable, can wait",
        stripText: "DON'T POWER ON. DON'T CHARGE.",
        stripSources: ["SWGDE 2025"],
        shortLabel: "off",
      },
      "phone.wiping": {
        reason: "wiping now, act first",
        stripText: "ACT NOW.",
        stripSources: ["Inferred"],
        shortLabel: "wiping",
      },
      "usb.plugged": {
        reason: "stable, can wait",
        stripText: "DON'T PULL IT OUT YET.",
        stripSources: ["Inferred"],
        shortLabel: "plugged in",
      },
      "usb.loose": {
        reason: "stable, can wait",
        stripText: "DON'T PLUG IT IN TO CHECK.",
        stripSources: ["INTERPOL 2021"],
        shortLabel: "loose",
      },
    }

    const stateIds = Object.keys(expectedMeta) as StateId[]
    for (const stateId of stateIds) {
      const { engine, clock } = makeSetup()
      clock.setTime("14:32:07")
      const { deviceId, answers } = ANSWERS_FOR_STATE[stateId]
      assessToState(engine, deviceId, answers)

      assert.equal(VOLATILE_RULES.states[stateId].shortLabel, expectedMeta[stateId].shortLabel)

      const view = engine.getDevice(deviceId)
      assert.equal(view.stateId, stateId)
      assert.equal(view.reason, expectedMeta[stateId].reason)
      assert.deepEqual(view.strip, {
        text: expectedMeta[stateId].stripText,
        sources: expectedMeta[stateId].stripSources,
      })
      assert.equal(view.stateLabel, VOLATILE_RULES.states[stateId].label)

      const log = engine.getLog()
      assert.equal(log.length, 1)
      assert.deepEqual(log[0], {
        kind: "assessed",
        time: "14:32:07",
        deviceId,
        text: `Assessed: ${VOLATILE_RULES.states[stateId].logLabel}`,
        line: `14:32:07, ${deviceId}, Assessed: ${VOLATILE_RULES.states[stateId].logLabel}`,
      })
    }

    assert.equal(VOLATILE_RULES.states["laptop.on.unlocked"].label, "ON · UNLOCKED")
    assert.equal(
      VOLATILE_RULES.states["laptop.on.unlocked"].logLabel,
      "on, unlocked, not wiping",
    )
    assert.equal(VOLATILE_RULES.states["phone.on.locked"].logLabel, "on, locked, not wiping")
  })
})

describe("Done Criterion 3: Dynamic #1..#k ranking, ties, strips, and out-of-order nudges", () => {
  it("re-sorts ranks as Router -> Phone -> Laptop -> USB are assessed, and counts a higher-ranked reassessing device in nudges", () => {
    const { engine, clock } = makeSetup()

    // 1. Router (NET-01, router.on) -> Router #1
    assessToState(engine, "NET-01", [0])
    assert.deepEqual(engine.getRanking(), [
      { deviceId: "NET-01", rank: 1, reason: "leave on, call an expert" },
    ])
    assert.equal(engine.getDevice("NET-01").rank, 1)
    assert.equal(engine.getDevice("NET-01").strip?.text, "DON'T LOG IN.")
    assert.equal(engine.getDevice("NET-01").nudge, null)
    assert.equal(engine.getDevice("PH-01").rank, null)

    // 2. Phone (PH-01, phone.on.locked) -> Phone #1, Router #2
    clock.advanceSeconds(5)
    const phEvents = assessToState(engine, "PH-01", [0, 0, 1])
    assert.deepEqual(
      phEvents.map((e) => e.type),
      ["logged", "assessed", "ranks_changed"],
    )
    assert.deepEqual(engine.getRanking(), [
      { deviceId: "PH-01", rank: 1, reason: "locked, could reboot or be wiped" },
      { deviceId: "NET-01", rank: 2, reason: "leave on, call an expert" },
    ])
    assert.equal(engine.getDevice("NET-01").nudge, "#1 Phone is still waiting")

    // 3. Laptop (LAP-01, laptop.on.unlocked) -> Laptop #1, Phone #2, Router #3
    clock.advanceSeconds(5)
    assessToState(engine, "LAP-01", [0, 1, 1])
    // 4. USB (USB-01, usb.plugged) -> Laptop #1, Phone #2, Router #3, USB #4
    clock.advanceSeconds(5)
    assessToState(engine, "USB-01", [0])
    assert.deepEqual(engine.getRanking(), [
      { deviceId: "LAP-01", rank: 1, reason: "on and unlocked, could lock" },
      { deviceId: "PH-01", rank: 2, reason: "locked, could reboot or be wiped" },
      { deviceId: "NET-01", rank: 3, reason: "leave on, call an expert" },
      { deviceId: "USB-01", rank: 4, reason: "stable, can wait" },
    ])

    // Even while #1 Laptop is being reassessed (question open), nudge on #2/#3/#4 still counts #1 Laptop!
    engine.beginReassess("LAP-01")
    engine.answerQuestion("LAP-01", 0) // mid-reassessment
    assert.notEqual(engine.getDevice("LAP-01").question, null)
    assert.equal(engine.getDevice("PH-01").nudge, "#1 Laptop is still waiting")
    assert.equal(engine.getDevice("NET-01").nudge, "#1 Laptop is still waiting")
    assert.equal(engine.getDevice("USB-01").nudge, "#1 Laptop is still waiting")
    // Finish Laptop reassessment back to laptop.on.unlocked
    engine.answerQuestion("LAP-01", 1)
    engine.answerQuestion("LAP-01", 1)

    // Complete all 4 steps on #1 Laptop: nudge shifts to #2 Phone (and disappears on #2 Phone)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    assert.equal(engine.getDevice("LAP-01").chip, "done")
    assert.equal(engine.getDevice("PH-01").nudge, null)
    assert.equal(engine.getDevice("NET-01").nudge, "#2 Phone is still waiting")
    assert.equal(engine.getDevice("USB-01").nudge, "#2 Phone is still waiting")
  })

  it("keeps the FIRST-assessed device ahead on ties even when that first-assessed device is reassessed or switched", () => {
    const { engine } = makeSetup()
    // Assess LAP-01 FIRST (Tier 2), PH-01 SECOND (Tier 3), NET-01 THIRD (Tier 4), USB-01 FOURTH (Tier 5)
    assessToState(engine, "LAP-01", [0, 1, 1]) // 1st
    assessToState(engine, "PH-01", [0, 0, 1]) // 2nd
    assessToState(engine, "NET-01", [0]) // 3rd
    assessToState(engine, "USB-01", [0]) // 4th

    // Reassess the FIRST-assessed device (LAP-01) into a Tier 3 tie with PH-01 (laptop.on.locked vs phone.on.locked):
    // LAP-01 must remain #1 ahead of PH-01 (#2)! (Catches re-stamping firstAssessedSeq on reassess)
    engine.beginReassess("LAP-01")
    assessToState(engine, "LAP-01", [0, 0, 1]) // laptop.on.locked (Tier 3)
    assert.deepEqual(
      engine.getRanking().map((r) => r.deviceId),
      ["LAP-01", "PH-01", "NET-01", "USB-01"],
    )
    assert.equal(engine.getDevice("LAP-01").rank, 1)
    assert.equal(engine.getDevice("PH-01").rank, 2)

    // Reassess the FIRST-assessed device (LAP-01) again into a Tier 5 tie with USB-01 (laptop.off vs usb.plugged):
    // LAP-01 must rank #3 ahead of USB-01 (#4)!
    engine.beginReassess("LAP-01")
    assessToState(engine, "LAP-01", [1]) // laptop.off (Tier 5)
    assert.deepEqual(
      engine.getRanking().map((r) => r.deviceId),
      ["PH-01", "NET-01", "LAP-01", "USB-01"],
    )

    // Reassess LAP-01 back to laptop.on.unlocked and state-switch it to laptop.off via None free -> Power: Removed:
    // LAP-01 still ranks #3 ahead of USB-01 (#4)!
    engine.beginReassess("LAP-01")
    assessToState(engine, "LAP-01", [0, 1, 1])
    engine.answerFact("LAP-01", 0) // Normal
    engine.answerFact("LAP-01", 1) // Any visible: No
    engine.answerFact("LAP-01", 1) // None free
    engine.answerFact("LAP-01", 0) // Power: Removed -> laptop.off
    assert.deepEqual(
      engine.getRanking().map((r) => r.deviceId),
      ["PH-01", "NET-01", "LAP-01", "USB-01"],
    )
  })
})

describe("Done Criterion 4: Strict step order, fact logging, chip states, and full-snapshot no-ops", () => {
  it("completes steps strictly in order, verifies logged event payloads, and transitions chip", () => {
    const { engine, clock } = makeSetup()
    clock.setTime("14:32:00")
    assessToState(engine, "NET-01", [0]) // router.on

    const initial = engine.getDevice("NET-01")
    assert.equal(initial.chip, "assessed")
    assert.equal(initial.activeStep, 0)
    assert.equal(initial.steps.length, 3)
    assert.equal(initial.steps[0].status, "active")
    assert.equal(initial.steps[1].status, "locked")
    assert.equal(initial.steps[1].fact, null)
    assert.equal(initial.steps[2].status, "locked")
    assert.equal(initial.steps[2].fact, null)

    const step1Id = initial.steps[0].id
    clock.setTime("14:32:04")
    const e1 = engine.answerFact("NET-01", 0)
    assertLoggedPayloadMatchesTail(e1, engine)
    assert.deepEqual(
      e1.map((e) => e.type),
      ["logged", "step_closed"],
    )
    assert.deepEqual(e1[1], { type: "step_closed", deviceId: "NET-01", stepId: step1Id })
    assert.equal(engine.getDevice("NET-01").chip, "in_progress")
    assert.equal(engine.getDevice("NET-01").activeStep, 1)

    clock.setTime("14:32:08")
    const e2 = engine.answerFact("NET-01", 1)
    assertLoggedPayloadMatchesTail(e2, engine)

    const step3Id = engine.getDevice("NET-01").steps[2].id
    clock.setTime("14:32:12")
    const e3 = engine.answerFact("NET-01", 0)
    assertLoggedPayloadMatchesTail(e3, engine)
    assert.deepEqual(
      e3.map((e) => e.type),
      ["logged", "step_closed", "device_done"],
    )
    assert.deepEqual(e3[1], { type: "step_closed", deviceId: "NET-01", stepId: step3Id })
    assert.deepEqual(e3[2], { type: "device_done", deviceId: "NET-01" })

    const doneView = engine.getDevice("NET-01")
    assert.equal(doneView.chip, "done")
    assert.equal(doneView.activeStep, -1)
    assert.ok(doneView.steps.every((s) => s.status === "done" && s.fact === null))

    const log = engine.getLog()
    assert.equal(log.length, 4)
    assert.equal(log[1].line, "14:32:04, NET-01, Lights: Blinking")
    assert.equal(log[2].line, "14:32:08, NET-01, Label: Unreadable")
    assert.equal(log[3].line, "14:32:12, NET-01, Expert: Flagged")
  })

  it("sets chip to in_progress even when the first fact answered in a state is a problem answer", () => {
    const { engine } = makeSetup()
    assessToState(engine, "PH-01", [0, 1, 1]) // phone.on.unlocked
    assert.equal(engine.getDevice("PH-01").chip, "assessed")

    engine.answerFact("PH-01", 1) // Step 1 Screen: Locked (problem!)
    assert.equal(engine.getDevice("PH-01").chip, "in_progress")
  })

  it("changes nothing across the entire engine snapshot on every disallowed call", () => {
    const { engine } = makeSetup()

    // Unassessed device: answerFact & beginReassess
    assertDisallowedNoOp(engine, () => engine.answerFact("LAP-01", 0))
    assertDisallowedNoOp(engine, () => engine.beginReassess("LAP-01"))

    // Same-scenario setScenario ("criminal" -> "criminal")
    assertDisallowedNoOp(engine, () => engine.setScenario("criminal"))

    // Second confirmScan
    engine.confirmScan()
    assertDisallowedNoOp(engine, () => engine.confirmScan())

    // Assessed device with no pending question: answerQuestion
    assessToState(engine, "LAP-01", [0, 1, 1])
    assertDisallowedNoOp(engine, () => engine.answerQuestion("LAP-01", 0))
    assertDisallowedNoOp(engine, () => engine.answerQuestion("LAP-01", 1))

    // During reassessment (at Q1 and mid-tree at Q2): answerFact and duplicate beginReassess
    engine.beginReassess("LAP-01")
    assertDisallowedNoOp(engine, () => engine.answerFact("LAP-01", 0))
    assertDisallowedNoOp(engine, () => engine.beginReassess("LAP-01"))
    engine.answerQuestion("LAP-01", 0) // advance to Q2 ("Locked" / "Unlocked")
    assertDisallowedNoOp(engine, () => engine.answerFact("LAP-01", 0))
    assertDisallowedNoOp(engine, () => engine.beginReassess("LAP-01")) // must not reset Q2 to Q1!

    // Finish LAP-01 reassessment and complete all steps on NET-01 -> answerFact on finished device
    engine.answerQuestion("LAP-01", 1)
    engine.answerQuestion("LAP-01", 1)
    assessToState(engine, "NET-01", [0])
    engine.answerFact("NET-01", 0)
    engine.answerFact("NET-01", 0)
    engine.answerFact("NET-01", 0)
    assert.equal(engine.getDevice("NET-01").chip, "done")
    assertDisallowedNoOp(engine, () => engine.answerFact("NET-01", 0))
    assertDisallowedNoOp(engine, () => engine.answerFact("NET-01", 1))

    // Same-scenario setScenario ("ransomware" -> "ransomware")
    engine.setScenario("ransomware")
    assertDisallowedNoOp(engine, () => engine.setScenario("ransomware"))
  })
})

describe("Problem answers, exact +1 log counts, corrective lines, Contested notes, and closing facts", () => {
  it("logs exactly +1 entry on problem, +1 on repeated problem, and +1 on problem-closing answer", () => {
    for (const answer of [0, 1] as AnswerIndex[]) {
      const { engine, clock } = makeSetup()
      assessToState(engine, "NET-01", [answer])
      engine.answerFact("NET-01", 0)
      engine.answerFact("NET-01", 0)

      const stepId = engine.getDevice("NET-01").steps[2].id
      const lenBeforeProb = engine.getLog().length
      clock.setTime("14:33:01")
      const probEvents = engine.answerFact("NET-01", 1) // Expert: Not yet
      assert.equal(engine.getLog().length, lenBeforeProb + 1)
      assertLoggedPayloadMatchesTail(probEvents, engine)
      assert.deepEqual(
        probEvents.map((e) => e.type),
        ["logged", "problem"],
      )
      assert.deepEqual(probEvents[1], { type: "problem", deviceId: "NET-01", stepId })

      const step = engine.getDevice("NET-01").steps[2]
      assert.equal(step.status, "active")
      assert.equal(step.problemOpen, true)
      assert.equal(step.text, "Flag it before you leave the room.")
      assert.deepEqual(step.sources, ["Inferred"])
      assert.equal(engine.getLog().at(-1)?.line, "14:33:01, NET-01, Expert: Not yet")

      // Repeating main-fact problem answer adds exactly +1 log entry and emits [logged, problem]
      const lenBeforeRepeat = engine.getLog().length
      clock.setTime("14:33:05")
      const repeatProb = engine.answerFact("NET-01", 1)
      assert.equal(engine.getLog().length, lenBeforeRepeat + 1)
      assertLoggedPayloadMatchesTail(repeatProb, engine)
      assert.deepEqual(
        repeatProb.map((e) => e.type),
        ["logged", "problem"],
      )
      assert.equal(engine.getLog().at(-1)?.line, "14:33:05, NET-01, Expert: Not yet")

      // Problem-closing answer adds exactly +1 log entry and restores original step text
      const lenBeforeClose = engine.getLog().length
      clock.setTime("14:33:09")
      const closeEvents = engine.answerFact("NET-01", 0) // Expert: Flagged
      assert.equal(engine.getLog().length, lenBeforeClose + 1)
      assertLoggedPayloadMatchesTail(closeEvents, engine)
      assert.equal(engine.getLog().at(-1)?.line, "14:33:09, NET-01, Expert: Flagged")
      assert.equal(engine.getDevice("NET-01").steps[2].status, "done")
      assert.equal(engine.getDevice("NET-01").steps[2].problemOpen, false)
      assert.notEqual(
        engine.getDevice("NET-01").steps[2].text,
        "Flag it before you leave the room.",
      )
      assert.equal(engine.getDevice("NET-01").chip, "done")
    }
  })

  it("handles phone.on.unlocked problems including Shielded closingFact stay/close with exact +1 log counts", () => {
    const { engine } = makeSetup()
    assessToState(engine, "PH-01", [0, 1, 1]) // phone.on.unlocked

    // Step 1: Screen: Unlocked / Locked ("Locked" is problem)
    const l0 = engine.getLog().length
    engine.answerFact("PH-01", 1)
    assert.equal(engine.getLog().length, l0 + 1)
    assert.equal(engine.getDevice("PH-01").steps[0].problemOpen, true)
    assert.equal(engine.getDevice("PH-01").steps[0].text, "It has locked. Pinch Reassess.")
    const l1 = engine.getLog().length
    engine.answerFact("PH-01", 0) // Unlocked closes step 1
    assert.equal(engine.getLog().length, l1 + 1)
    assert.equal(engine.getDevice("PH-01").steps[0].status, "done")

    // Step 2: Power: Connected / No charger
    engine.answerFact("PH-01", 1)
    assert.equal(engine.getDevice("PH-01").steps[1].status, "done")

    // Step 3: Radios: All off / Still on -> Shielded: Yes / Not yet
    const l2 = engine.getLog().length
    engine.answerFact("PH-01", 1) // Still on
    assert.equal(engine.getLog().length, l2 + 1)
    let s3 = engine.getDevice("PH-01").steps[2]
    assert.equal(s3.problemOpen, true)
    assert.equal(s3.text, "Shield the phone now.")
    assert.deepEqual(s3.fact, { stem: "Shielded:", answers: ["Yes", "Not yet"] })

    // "Not yet" (1) is {kind: "stay"} -> emits ONLY [logged], +1 log entry, stays open
    const logBeforeStay = engine.getLog().length
    const stayEvents = engine.answerFact("PH-01", 1)
    assert.equal(engine.getLog().length, logBeforeStay + 1)
    assertLoggedPayloadMatchesTail(stayEvents, engine)
    assert.deepEqual(
      stayEvents.map((e) => e.type),
      ["logged"],
    )
    assert.equal(engine.getLog().at(-1)?.text, "Shielded: Not yet")
    s3 = engine.getDevice("PH-01").steps[2]
    assert.equal(s3.status, "active")
    assert.equal(s3.problemOpen, true)

    // "Yes" (0) closes step 3 with +1 log entry
    const logBeforeClose = engine.getLog().length
    const closeEv = engine.answerFact("PH-01", 0)
    assert.equal(engine.getLog().length, logBeforeClose + 1)
    assertLoggedPayloadMatchesTail(closeEv, engine)
    assert.equal(engine.getLog().at(-1)?.text, "Shielded: Yes")
    assert.equal(engine.getDevice("PH-01").steps[2].status, "done")
    assert.equal(engine.getDevice("PH-01").steps[2].problemOpen, false)

    // Step 4: Signal in bag: None / Still showing
    const l4 = engine.getLog().length
    engine.answerFact("PH-01", 1) // Still showing
    assert.equal(engine.getLog().length, l4 + 1)
    assert.equal(engine.getDevice("PH-01").steps[3].text, "Reseal or change the bag.")
    const l5 = engine.getLog().length
    engine.answerFact("PH-01", 0) // None closes
    assert.equal(engine.getLog().length, l5 + 1)
    assert.equal(engine.getDevice("PH-01").chip, "done")
  })

  it("handles phone.on.locked, laptop.on.locked, usb.plugged, phone.wiping, and non-problem states", () => {
    // phone.on.locked
    {
      const { engine, clock } = makeSetup()
      clock.setTime("14:32:07")
      assessToState(engine, "PH-01", [0, 0, 1])
      engine.answerFact("PH-01", 0)
      engine.answerFact("PH-01", 0)
      const n1 = engine.getLog().length
      engine.answerFact("PH-01", 1) // Signal in bag: Still showing
      assert.equal(engine.getLog().length, n1 + 1)
      assert.equal(engine.getLog().at(-1)?.line, "14:32:07, PH-01, Signal in bag: Still showing")
      assert.equal(engine.getDevice("PH-01").steps[2].text, "Reseal or change the bag.")
      engine.answerFact("PH-01", 0) // None
      assert.equal(engine.getLog().length, n1 + 2)

      engine.answerFact("PH-01", 1) // Handover: Waiting
      assert.equal(engine.getLog().length, n1 + 3)
      assert.equal(
        engine.getDevice("PH-01").steps[3].text,
        "Keep it powered and shielded until handover.",
      )
      engine.answerFact("PH-01", 0) // Done
      assert.equal(engine.getLog().length, n1 + 4)
      assert.equal(engine.getDevice("PH-01").chip, "done")
    }

    // laptop.on.locked
    {
      const { engine } = makeSetup()
      assessToState(engine, "LAP-01", [0, 0, 1])
      engine.answerFact("LAP-01", 0)
      engine.answerFact("LAP-01", 1)
      const n = engine.getLog().length
      engine.answerFact("LAP-01", 1) // Trained staff: None free
      assert.equal(engine.getLog().length, n + 1)
      const s3 = engine.getDevice("LAP-01").steps[2]
      assert.equal(s3.problemOpen, true)
      assert.equal(s3.text, "Keep it on and powered. Keep trying to reach trained staff.")
      assert.equal(
        s3.contested,
        "NIJ 2008 and ACPO 2012 would remove power if no encryption is suspected.",
      )
      engine.answerFact("LAP-01", 0) // Coming
      assert.equal(engine.getLog().length, n + 2)
      assert.equal(engine.getDevice("LAP-01").chip, "done")
    }

    // usb.plugged
    {
      const { engine } = makeSetup()
      assessToState(engine, "USB-01", [0])
      engine.answerFact("USB-01", 0)
      engine.answerFact("USB-01", 1) // Labelled: Drive only
      assert.equal(engine.getDevice("USB-01").steps[1].text, "Label the port too.")
      engine.answerFact("USB-01", 0)
      engine.answerFact("USB-01", 1) // Laptop decision: Not yet
      assert.equal(
        engine.getDevice("USB-01").steps[2].text,
        "Leave it in. Come back after the laptop.",
      )
      engine.answerFact("USB-01", 0)
      engine.answerFact("USB-01", 1)
      assert.equal(engine.getDevice("USB-01").chip, "done")
    }

    // phone.wiping
    {
      const { engine } = makeSetup()
      assessToState(engine, "PH-01", [0, 0, 0])
      engine.answerFact("PH-01", 1)
      assert.equal(engine.getDevice("PH-01").steps[0].text, "Reseal or change the bag.")
      engine.answerFact("PH-01", 0)
      engine.answerFact("PH-01", 1)
      assert.equal(
        engine.getDevice("PH-01").steps[1].text,
        "Keep trying to reach trained staff.",
      )
      engine.answerFact("PH-01", 0)
      assert.equal(engine.getDevice("PH-01").chip, "done")
    }

    // laptop.off, phone.off, usb.loose
    for (const stateId of ["laptop.off", "phone.off", "usb.loose"] as StateId[]) {
      const { engine } = makeSetup()
      const { deviceId, answers } = ANSWERS_FOR_STATE[stateId]
      assessToState(engine, deviceId, answers)
      assert.equal(engine.getDevice(deviceId).steps.length, 3)
      engine.answerFact(deviceId, 0)
      engine.answerFact(deviceId, 1)
      engine.answerFact(deviceId, 0)
      assert.equal(engine.getDevice(deviceId).chip, "done")
    }
  })
})

describe("Laptop 'call' step variant selection and state switches", () => {
  it("picks keep-on variant when 'Any visible' was Yes, closing on 'Coming'", () => {
    const { engine } = makeSetup()
    assessToState(engine, "LAP-01", [0, 1, 1])

    engine.answerFact("LAP-01", 0) // Screen: Normal
    engine.answerFact("LAP-01", 0) // Any visible: Yes
    const n = engine.getLog().length
    engine.answerFact("LAP-01", 1) // Trained staff: None free
    assert.equal(engine.getLog().length, n + 1)

    const s3 = engine.getDevice("LAP-01").steps[2]
    assert.equal(s3.problemOpen, true)
    assert.equal(s3.text, "Keep it on. Keep trying to reach trained staff.")
    assert.deepEqual(s3.sources, ["INTERPOL 2021"])
    assert.equal(s3.contested, null)
    assert.deepEqual(s3.fact, { stem: "Trained staff:", answers: ["Coming", "None free"] })

    engine.answerFact("LAP-01", 0) // Trained staff: Coming
    assert.equal(engine.getLog().length, n + 2)
    assert.equal(engine.getDevice("LAP-01").steps[2].status, "done")
    assert.equal(engine.getDevice("LAP-01").steps[2].problemOpen, false)
  })

  it("picks remove-power Contested variant when 'Any visible' was No, stays on 'Still on', and switches to laptop.off on 'Removed'", () => {
    const { engine } = makeSetup()
    assessToState(engine, "NET-01", [0]) // Router #1 (Tier 4)
    assessToState(engine, "LAP-01", [0, 1, 1]) // Laptop #1 (Tier 2), Router #2

    engine.answerFact("LAP-01", 0) // Screen: Normal
    engine.answerFact("LAP-01", 1) // Any visible: No
    engine.answerFact("LAP-01", 1) // Trained staff: None free

    let s3 = engine.getDevice("LAP-01").steps[2]
    assert.equal(s3.problemOpen, true)
    assert.equal(s3.text, "Remove power at the device end, not the wall.")
    assert.deepEqual(s3.sources, ["NIJ 2008", "ACPO 2012"])
    assert.equal(
      s3.contested,
      "NIJ 2008 and ACPO 2012: remove power. INTERPOL 2021: keep it on if an expert can come.",
    )
    assert.deepEqual(s3.fact, { stem: "Power:", answers: ["Removed", "Still on"] })

    // "Still on" (1) emits ONLY [logged] and keeps step open
    const logLenBeforeStay = engine.getLog().length
    const stayEvents = engine.answerFact("LAP-01", 1)
    assertLoggedPayloadMatchesTail(stayEvents, engine)
    assert.deepEqual(
      stayEvents.map((e) => e.type),
      ["logged"],
    )
    assert.equal(engine.getLog().length, logLenBeforeStay + 1)

    // "Removed" (0) emits [logged, state_switched, ranks_changed] and switches to laptop.off
    const logLenBeforeSwitch = engine.getLog().length
    const switchEvents = engine.answerFact("LAP-01", 0)
    assertLoggedPayloadMatchesTail(switchEvents, engine)
    assert.deepEqual(
      switchEvents.map((e) => e.type),
      ["logged", "state_switched", "ranks_changed"],
    )
    assert.deepEqual(switchEvents[1], {
      type: "state_switched",
      deviceId: "LAP-01",
      from: "laptop.on.unlocked",
      to: "laptop.off",
    })
    assert.equal(engine.getLog().length, logLenBeforeSwitch + 1)

    const lapAfter = engine.getDevice("LAP-01")
    assert.equal(lapAfter.stateId, "laptop.off")
    assert.equal(lapAfter.chip, "assessed")
    assert.equal(lapAfter.strip?.text, "DON'T SWITCH IT ON.")
    assert.equal(lapAfter.rank, 2)
    assert.equal(lapAfter.activeStep, 0)
    assert.equal(lapAfter.steps[0].text, "Photograph it and its cables.")
  })

  it("switches laptop to laptop.wiping at rank #1 on 'Wiping', and pulling power in laptop.wiping does NOT switch to laptop.off", () => {
    const { engine } = makeSetup()
    assessToState(engine, "PH-01", [0, 1, 1]) // Tier 2 -> #1
    assessToState(engine, "LAP-01", [0, 1, 1]) // Tier 2 -> #2

    const logBefore = engine.getLog().length
    const wipeEvents = engine.answerFact("LAP-01", 1) // Screen: Wiping
    assertLoggedPayloadMatchesTail(wipeEvents, engine)
    assert.deepEqual(
      wipeEvents.map((e) => e.type),
      ["logged", "state_switched", "ranks_changed"],
    )
    assert.equal(engine.getLog().length, logBefore + 1)
    assert.equal(engine.getDevice("LAP-01").stateId, "laptop.wiping")
    assert.equal(engine.getDevice("LAP-01").rank, 1)

    engine.answerFact("LAP-01", 1) // Power: Still on -> problem
    assert.equal(
      engine.getDevice("LAP-01").steps[0].text,
      "Remove the battery if you can. Call trained staff now.",
    )

    const pullEvents = engine.answerFact("LAP-01", 0) // Power: Pulled -> closes step 1, no switch
    assert.deepEqual(
      pullEvents.map((e) => e.type),
      ["logged", "step_closed"],
    )
    assert.equal(engine.getDevice("LAP-01").stateId, "laptop.wiping")
    assert.equal(engine.getDevice("LAP-01").rank, 1)
    assert.equal(engine.getDevice("LAP-01").activeStep, 1)
  })
})

describe("Done Criterion 5: Scenario switch, ransomware-first assessment, and reassessment (r2 & r3)", () => {
  it("opens laptop.on.unlocked directly in ransomware step order when setScenario('ransomware') is called before assessment", () => {
    const { engine } = makeSetup()
    engine.setScenario("ransomware")
    assessToState(engine, "LAP-01", [0, 1, 1])

    const view = engine.getDevice("LAP-01")
    assert.equal(view.steps.length, 4)
    assert.equal(view.activeStep, 0)
    assert.equal(view.steps[0].text, "Photograph the screen with the date, time and time zone.")
    assert.equal(view.steps[1].text, "Isolate from the network now: unplug the network cable.")
    assert.equal(
      view.steps[2].text,
      "Look, don't touch: encryption, mounted drives, cloud or remote sessions.",
    )
    assert.equal(view.steps[3].text, "Don't shut down. Call trained personnel.")

    engine.answerFact("LAP-01", 0) // photo
    assert.equal(engine.getDevice("LAP-01").activeStep, 1)
    assert.deepEqual(engine.getDevice("LAP-01").steps[1].sources, ["CISA 2023"])
  })

  it("switches scenario with [logged, scenario_changed], moves network step to #2 [CISA 2023], reopens it, and preserves other done steps", () => {
    const { engine, clock } = makeSetup()
    assessToState(engine, "LAP-01", [0, 1, 1])

    const crimSteps = engine.getDevice("LAP-01").steps
    engine.answerFact("LAP-01", 0) // photo
    engine.answerFact("LAP-01", 0) // look (Any visible: Yes)
    engine.answerFact("LAP-01", 0) // call
    engine.answerFact("LAP-01", 1) // Network: Cut
    assert.equal(engine.getDevice("LAP-01").chip, "done")

    clock.setTime("14:35:00")
    const logBefore = engine.getLog().length
    const scenEvents = engine.setScenario("ransomware")
    assert.equal(engine.getLog().length, logBefore + 1)
    assertLoggedPayloadMatchesTail(scenEvents, engine)
    assert.deepEqual(
      scenEvents.map((e) => e.type),
      ["logged", "scenario_changed"],
    )
    assert.deepEqual(scenEvents[1], { type: "scenario_changed", scenario: "ransomware" })
    assert.equal(engine.getLog().at(-1)?.line, "14:35:00, Scenario: Ransomware response")

    const ranView = engine.getDevice("LAP-01")
    assert.equal(ranView.chip, "in_progress")
    assert.equal(ranView.activeStep, 1)
    assert.equal(ranView.steps[0].id, crimSteps[0].id)
    assert.equal(ranView.steps[0].status, "done")
    assert.equal(ranView.steps[1].id, crimSteps[3].id)
    assert.equal(ranView.steps[1].status, "active")
    assert.equal(ranView.steps[1].text, "Isolate from the network now: unplug the network cable.")
    assert.deepEqual(ranView.steps[1].sources, ["CISA 2023"])
    assert.equal(ranView.steps[2].status, "done")
    assert.equal(ranView.steps[3].status, "done")

    // Problem on ransomware network step ("Can't") then close via "Switch cut"
    const n1 = engine.getLog().length
    engine.answerFact("LAP-01", 1) // Can't
    assert.equal(engine.getLog().length, n1 + 1)
    assert.equal(engine.getDevice("LAP-01").steps[1].problemOpen, true)
    engine.answerFact("LAP-01", 0) // Switch cut
    assert.equal(engine.getLog().length, n1 + 2)
    assert.equal(engine.getDevice("LAP-01").steps[1].problemOpen, false)
    assert.equal(
      engine.getDevice("LAP-01").steps[1].text,
      "Isolate from the network now: unplug the network cable.",
    )
    assert.equal(engine.getDevice("LAP-01").chip, "done")

    // Open problem on network clears on scenario switch (r2 Rule 9), and "Power removed" switches to laptop.off
    engine.setScenario("criminal")
    engine.setScenario("ransomware")
    engine.answerFact("LAP-01", 1) // Can't -> open problem
    engine.setScenario("criminal")
    assert.equal(engine.getDevice("LAP-01").steps[3].problemOpen, false)

    engine.setScenario("ransomware")
    engine.answerFact("LAP-01", 1) // Can't
    const pwrEvents = engine.answerFact("LAP-01", 1) // Power removed
    assert.deepEqual(
      pwrEvents.map((e) => e.type),
      ["logged", "state_switched", "ranks_changed"],
    )
    assert.equal(engine.getDevice("LAP-01").stateId, "laptop.off")
  })

  it("applies scenario switch even to a device currently being reassessed, updating its chip (r3 Rule 14)", () => {
    const { engine } = makeSetup()
    assessToState(engine, "LAP-01", [0, 1, 1])
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    assert.equal(engine.getDevice("LAP-01").chip, "done")

    // Start reassessment on LAP-01: question is open, chip still reports "done" from old state's steps
    engine.beginReassess("LAP-01")
    engine.answerQuestion("LAP-01", 0)
    assert.notEqual(engine.getDevice("LAP-01").question, null)
    assert.equal(engine.getDevice("LAP-01").chip, "done")

    // Switch scenario while LAP-01 is mid-reassessment: network step reopens and chip updates to "in_progress"!
    engine.setScenario("ransomware")
    const mid = engine.getDevice("LAP-01")
    assert.notEqual(mid.question, null)
    assert.equal(mid.chip, "in_progress")
    assert.equal(mid.activeStep, 1)
    assert.equal(mid.steps[1].status, "active")

    // Completing reassessment to the same state preserves the reopened ransomware step
    engine.answerQuestion("LAP-01", 1)
    engine.answerQuestion("LAP-01", 1)
    const after = engine.getDevice("LAP-01")
    assert.equal(after.question, null)
    assert.equal(after.chip, "in_progress")
    assert.equal(after.activeStep, 1)
  })

  it("preserves an open problem on 'call' and recorded 'Any visible' answer (both Yes and No) across scenario switches", () => {
    for (const anyVisibleAnswer of [0, 1] as AnswerIndex[]) {
      const { engine } = makeSetup()
      assessToState(engine, "LAP-01", [0, 1, 1])
      engine.answerFact("LAP-01", 0) // photo
      engine.answerFact("LAP-01", anyVisibleAnswer) // look: Yes (0) or No (1)

      // Switch to ransomware BEFORE answering 'call' -> 'Any visible' answer must remain recorded!
      engine.setScenario("ransomware")
      engine.answerFact("LAP-01", 0) // Isolated: Yes -> advances past done look (#3) to call (#4)
      engine.answerFact("LAP-01", 1) // Trained staff: None free
      const expectedText =
        anyVisibleAnswer === 0
          ? "Keep it on. Keep trying to reach trained staff."
          : "Remove power at the device end, not the wall."
      assert.equal(engine.getDevice("LAP-01").steps[3].text, expectedText)
      assert.equal(engine.getDevice("LAP-01").steps[3].problemOpen, true)

      // Switch back to criminal while problem is open on 'call': open problem stays on 'call'!
      engine.setScenario("criminal")
      const crim = engine.getDevice("LAP-01")
      assert.equal(crim.activeStep, 2) // call is #3 again
      assert.equal(crim.steps[2].problemOpen, true)
      assert.equal(crim.steps[2].text, expectedText)
    }
  })

  it("reassesses device per r2 Rule 5: keeps reporting old state while open, emits ranks_changed only on state change, keeps progress/problems/clock on same state, restarts on changed state", () => {
    const { engine, clock } = makeSetup()
    assessToState(engine, "PH-01", [0, 0, 1]) // phone.on.locked

    clock.advanceSeconds(30)
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 1) // Signal in bag: Still showing (open problem!)

    const logBeforeReassess = engine.getLog().length
    const beginEvents = engine.beginReassess("PH-01")
    assert.equal(engine.getLog().length, logBeforeReassess)
    assert.deepEqual(beginEvents, [
      {
        type: "question_asked",
        deviceId: "PH-01",
        questionId: VOLATILE_RULES.firstQuestion.phone,
      },
    ])

    const midReassess = engine.getDevice("PH-01")
    assert.equal(midReassess.stateId, "phone.on.locked")
    assert.equal(midReassess.chip, "in_progress")
    assert.equal(midReassess.rank, 1)
    assert.equal(midReassess.steps.length, 4)
    assert.equal(midReassess.activeStep, 2)
    assert.equal(midReassess.clockSeconds, 30)

    // Reassess to SAME state (phone.on.locked): [logged, assessed] WITHOUT ranks_changed
    clock.advanceSeconds(10)
    clock.setTime("14:40:00")
    const sameEvents = assessToState(engine, "PH-01", [0, 0, 1])
    assert.deepEqual(
      sameEvents.map((e) => e.type),
      ["logged", "assessed"],
    )
    assert.deepEqual(sameEvents[1], {
      type: "assessed",
      deviceId: "PH-01",
      state: "phone.on.locked",
      reassessed: true,
    })
    assert.equal(engine.getLog().at(-1)?.line, "14:40:00, PH-01, Reassessed: locked to locked")
    assert.equal(engine.getDevice("PH-01").activeStep, 2)
    assert.equal(engine.getDevice("PH-01").steps[2].problemOpen, true)
    assert.equal(engine.getDevice("PH-01").clockSeconds, 40)

    // Reassess to CHANGED state (phone.on.unlocked): [logged, assessed, ranks_changed]
    engine.beginReassess("PH-01")
    clock.setTime("14:41:00")
    const changeEvents = assessToState(engine, "PH-01", [0, 1, 1])
    assert.deepEqual(
      changeEvents.map((e) => e.type),
      ["logged", "assessed", "ranks_changed"],
    )
    assert.equal(engine.getLog().at(-1)?.line, "14:41:00, PH-01, Reassessed: locked to unlocked")
    const afterChange = engine.getDevice("PH-01")
    assert.equal(afterChange.stateId, "phone.on.unlocked")
    assert.equal(afterChange.chip, "assessed")
    assert.equal(afterChange.activeStep, 0)
    assert.equal(afterChange.steps[0].problemOpen, false)
    assert.equal(afterChange.clockSeconds, null)
  })
})

describe("Phone seizure clock exclusivity, scenario invariance, and freeze on secured (r3 Rule 13)", () => {
  it("runs only in phone.on.locked, does NOT restart on scenario switch, restarts on state re-entry, and is null in all other 11 states", () => {
    const expectedNote =
      "vendor-reported, iPhone only: USB data may lock after about 1 hour locked, reboot to full encryption after about 72 hours"

    const { engine, clock } = makeSetup()
    assessToState(engine, "PH-01", [0, 0, 1])
    assert.equal(engine.getDevice("PH-01").clockSeconds, 0)
    assert.ok(engine.getDevice("PH-01").clockLabel.includes("Locked for at least"))
    assert.equal(engine.getDevice("PH-01").clockNote, expectedNote)

    // Sub-second rounding down (Rule 12)
    clock.advanceMs(4_900)
    assert.equal(engine.getDevice("PH-01").clockSeconds, 4)
    assert.equal(engine.getElapsedSeconds(), 4)
    clock.advanceMs(45_100) // 50s total
    assert.equal(engine.getDevice("PH-01").clockSeconds, 50)

    // Scenario switch must NOT restart or alter the phone seizure clock!
    engine.setScenario("ransomware")
    assert.equal(engine.getDevice("PH-01").clockSeconds, 50)
    clock.advanceSeconds(202) // 252s total = 00:04:12
    assert.equal(engine.getDevice("PH-01").clockSeconds, 252)
    engine.setScenario("criminal")
    assert.equal(engine.getDevice("PH-01").clockSeconds, 252)

    // Leaving phone.on.locked clears clock; re-entering restarts from 0 (Rule 6)
    engine.beginReassess("PH-01")
    assessToState(engine, "PH-01", [0, 1, 1])
    assert.equal(engine.getDevice("PH-01").clockSeconds, null)
    assert.equal(engine.getDevice("PH-01").clockLabel, "")
    assert.equal(engine.getDevice("PH-01").clockNote, "")

    clock.advanceSeconds(60)
    engine.beginReassess("PH-01")
    assessToState(engine, "PH-01", [0, 0, 1])
    assert.equal(engine.getDevice("PH-01").clockSeconds, 0)

    // All other 11 states have null clock
    const nonClockStates = (Object.keys(ANSWERS_FOR_STATE) as StateId[]).filter(
      (s) => s !== "phone.on.locked",
    )
    for (const stateId of nonClockStates) {
      const sub = makeSetup()
      const { deviceId, answers } = ANSWERS_FOR_STATE[stateId]
      assessToState(sub.engine, deviceId, answers)
      sub.clock.advanceSeconds(60)
      const view = sub.engine.getDevice(deviceId)
      assert.equal(view.clockSeconds, null, `Expected null clockSeconds in ${stateId}`)
      assert.equal(view.clockLabel, "", `Expected empty clockLabel in ${stateId}`)
      assert.equal(view.clockNote, "", `Expected empty clockNote in ${stateId}`)
    }
  })
})

describe("Done Criterion 6: Scene secured edges, pending-question gating (r3 Rule 13), frozen clocks, and finality", () => {
  it("blocks secured on an unassessed 4th device, on an assessed untouched 4th device, and on open problems, then freezes both getElapsedSeconds() and clockSeconds", () => {
    const { engine, clock } = makeSetup()

    clock.advanceSeconds(10)
    // Assess and completely finish 3 devices (zero open problems!) while USB-01 is still unassessed
    assessToState(engine, "NET-01", [0])
    engine.answerFact("NET-01", 0)
    engine.answerFact("NET-01", 0)
    engine.answerFact("NET-01", 0)
    assert.equal(engine.getDevice("NET-01").chip, "done")

    assessToState(engine, "PH-01", [0, 0, 1]) // phone.on.locked enters at t = 10s
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)
    assert.equal(engine.getDevice("PH-01").chip, "done")

    assessToState(engine, "LAP-01", [0, 1, 1])
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    assert.equal(engine.getDevice("LAP-01").chip, "done")

    // Non-vacuous check: 3 devices completely done, 4th unassessed -> false!
    assert.equal(engine.isSceneSecured(), false)

    // Assess 4th device (USB-01) with untouched steps (chip === "assessed") while other 3 are done -> still false!
    clock.advanceSeconds(20) // t = 30s
    assessToState(engine, "USB-01", [0])
    assert.equal(engine.getDevice("USB-01").chip, "assessed")
    assert.equal(engine.isSceneSecured(), false)

    // Advance USB-01 to step 3 and trigger an open problem -> still false!
    engine.answerFact("USB-01", 0)
    engine.answerFact("USB-01", 0)
    engine.answerFact("USB-01", 1) // Laptop decision: Not yet (open problem!)
    assert.equal(engine.isSceneSecured(), false)

    // Resolve problem and finish final USB-01 step at t = 75s (phone clock = 65s) -> Scene secured!
    clock.advanceSeconds(45) // t = 75s
    engine.answerFact("USB-01", 0) // Laptop decision: Made
    assert.equal(engine.isSceneSecured(), false)

    const finalEvents = engine.answerFact("USB-01", 0) // USB: Bagged
    assertLoggedPayloadMatchesTail(finalEvents, engine)
    assert.deepEqual(
      finalEvents.map((e) => e.type),
      ["logged", "step_closed", "device_done", "scene_secured"],
    )
    assert.equal(engine.isSceneSecured(), true)
    assert.equal(engine.getElapsedSeconds(), 75)
    assert.equal(engine.getDevice("PH-01").clockSeconds, 65)

    // Advance clock +300s after secured: BOTH getElapsedSeconds() AND phone clockSeconds stay frozen! (r3 Rule 13)
    clock.advanceSeconds(300)
    assert.equal(engine.getElapsedSeconds(), 75)
    assert.equal(engine.getDevice("PH-01").clockSeconds, 65)

    // Secured is final: every changing call is a full-snapshot no-op!
    assertDisallowedNoOp(engine, () => engine.confirmScan())
    assertDisallowedNoOp(engine, () => engine.setScenario("ransomware"))
    assertDisallowedNoOp(engine, () => engine.beginReassess("PH-01"))
    assertDisallowedNoOp(engine, () => engine.answerQuestion("PH-01", 0))
    assertDisallowedNoOp(engine, () => engine.answerFact("PH-01", 0))
  })

  it("blocks Scene secured while a device has a pending reassessment question, and emits scene_secured from the answerQuestion that finishes reassessment (r3 Rule 13)", () => {
    const { engine, clock } = makeSetup()

    // Assess all four; finish laptop, router, and phone; leave 1 USB step open
    assessToState(engine, "LAP-01", [0, 1, 1])
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)
    engine.answerFact("LAP-01", 0)

    assessToState(engine, "NET-01", [0])
    engine.answerFact("NET-01", 0)
    engine.answerFact("NET-01", 0)
    engine.answerFact("NET-01", 0)

    assessToState(engine, "PH-01", [0, 0, 1])
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)
    engine.answerFact("PH-01", 0)

    assessToState(engine, "USB-01", [0])
    engine.answerFact("USB-01", 0)
    engine.answerFact("USB-01", 0)
    engine.answerFact("USB-01", 0) // 1 USB step still open

    // Begin reassessing LAP-01 and answer Q1 so LAP-01 has a pending question
    engine.beginReassess("LAP-01")
    engine.answerQuestion("LAP-01", 0)
    assert.notEqual(engine.getDevice("LAP-01").question, null)

    // Finish the last USB step while LAP-01's question is still pending: MUST NOT secure scene!
    clock.advanceSeconds(40)
    const usbDoneEvents = engine.answerFact("USB-01", 0)
    assert.deepEqual(
      usbDoneEvents.map((e) => e.type),
      ["logged", "step_closed", "device_done"],
    )
    assert.equal(engine.isSceneSecured(), false)

    // Answer Q2 on LAP-01 -> still pending Q3, still false
    clock.advanceSeconds(5)
    const q3Events = engine.answerQuestion("LAP-01", 1)
    assert.equal(q3Events.length, 1)
    assert.equal(q3Events[0].type, "question_asked")
    assert.equal(engine.isSceneSecured(), false)

    // Answer Q3 ("No") returning LAP-01 to laptop.on.unlocked (all steps already done):
    // This answerQuestion is the last thing missing -> emits [logged, assessed, scene_secured] and freezes clocks!
    clock.advanceSeconds(15) // t = 60s
    const finalReassessEvents = engine.answerQuestion("LAP-01", 1)
    assertLoggedPayloadMatchesTail(finalReassessEvents, engine)
    assert.deepEqual(
      finalReassessEvents.map((e) => e.type),
      ["logged", "assessed", "scene_secured"],
    )
    assert.equal(engine.isSceneSecured(), true)
    assert.equal(engine.getElapsedSeconds(), 60)
    assert.equal(engine.getDevice("PH-01").clockSeconds, 60)

    clock.advanceSeconds(90)
    assert.equal(engine.getElapsedSeconds(), 60)
    assert.equal(engine.getDevice("PH-01").clockSeconds, 60)
  })
})
