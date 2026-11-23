/**
 * Volatile version 2 — the contract between the rules (data), the engine (pure logic)
 * and the view (Lens Studio UI).
 *
 * OWNED BY CLAUDE. AGY must not edit this file. To ask for a change, write it under
 * "Contract change requests" in notes/build/agy-status.md and keep working around it.
 *
 * Everything here is plain TypeScript: no Lens Studio types, no globals, erasable syntax
 * only (no enums, namespaces, decorators or parameter properties), so the rules and the
 * engine run unchanged in Node and in Lens Studio.
 *
 * Source of truth for behaviour and wording: devpost/design-brief.md.
 *
 * Revision 2 (2026-11-22). Changes from revision 1 are marked "r2". The numbered
 * "Behaviour rules" above the engine interface are part of the contract.
 */

// ───────────────────────────── Identifiers ─────────────────────────────

export type DeviceId = "LAP-01" | "NET-01" | "PH-01" | "USB-01"
export type DeviceKind = "laptop" | "router" | "phone" | "usb"
export type Scenario = "criminal" | "ransomware"

export type StateId =
  | "laptop.on.unlocked"
  | "laptop.on.locked"
  | "laptop.off"
  | "laptop.wiping"
  | "router.on"
  | "router.off"
  | "phone.on.unlocked"
  | "phone.on.locked"
  | "phone.off"
  | "phone.wiping"
  | "usb.plugged"
  | "usb.loose"

/** Index of the pinched button: 0 is the left answer, 1 the right. */
export type AnswerIndex = 0 | 1

// ───────────────────────────── Rules (data) ─────────────────────────────

export type DeviceDef = {
  id: DeviceId
  kind: DeviceKind
  /** Display name used in the nudge line and the log, e.g. "Laptop". */
  name: string
}

/** One node of a device kind's question tree. Each answer leads to another question or to a state. */
export type QuestionDef = {
  id: string
  /** e.g. "Power:" or "Being wiped?" */
  stem: string
  answers: [QuestionAnswer, QuestionAnswer]
}

export type QuestionAnswer = {
  label: string
  next: {question: string} | {state: StateId}
}

export type FactDef = {
  /** e.g. "Signal in bag:" */
  stem: string
  answers: [FactAnswer, FactAnswer]
}

export type FactAnswer = {
  label: string
  /** Omitted: the answer is logged and the step closes. */
  outcome?: Outcome
}

export type Outcome =
  /** Logged; the step stays open with the same fact (used inside closing facts). */
  | {kind: "stay"}
  /** Logged; the device takes this state's rank, strip and steps from step 1. No extra log entry. */
  | {kind: "switch"; state: StateId}
  /** Logged; the step stays open and shows a corrective line. Only on a step's main fact. */
  | {kind: "problem"; variants: ProblemVariant[]}

export type ProblemVariant = {
  /** Pick this variant when an earlier fact in the same state got this answer. Omitted: the default. */
  when?: {stepId: string; answer: AnswerIndex}
  /** Replaces the step text while the problem is open. */
  corrective: string
  /** Source chip for the corrective line. Omitted: the step's own sources. */
  sources?: string[]
  /** One-line note shown with a Contested chip. */
  contested?: string
  /** Fact shown while the problem is open. Omitted: the step's main fact again; its non-problem answer closes the step. */
  closingFact?: FactDef
}

export type StepDef = {
  /** Stable within a state, e.g. "photo", "look", "call", "network". Completion is tracked by this id. */
  id: string
  text: string
  /** Source chips, e.g. ["NIJ 2008", "INTERPOL 2021"] or ["Inferred"]. */
  sources: string[]
  /** One-line note shown with a Contested chip on the step itself. */
  contested?: string
  fact: FactDef
  /** True for a step whose question changes with the scenario: it reopens when the scenario is switched. */
  reopenOnScenarioSwitch?: boolean
}

export type StateDef = {
  id: StateId
  kind: DeviceKind
  /** Card header, e.g. "ON · UNLOCKED". */
  label: string
  /** Used in the Assessed log entry, e.g. "on, unlocked, not wiping". */
  logLabel: string
  /** r2. Used in the Reassessed log entry, e.g. "unlocked" in "Reassessed: unlocked to locked". */
  shortLabel: string
  /** Urgency tier, 1 (act first) to 5 (stable). */
  tier: 1 | 2 | 3 | 4 | 5
  /** One-line reason shown with the rank, e.g. "on and unlocked, could lock". */
  reason: string
  strip: {text: string; sources: string[]}
  /** Steps in order. `ransomware` is only given where the order or wording differs. */
  steps: {criminal: StepDef[]; ransomware?: StepDef[]}
  /** Present on states that run the seizure clock (the locked phone). */
  clock?: {label: string; note: string}
}

export type Rules = {
  devices: DeviceDef[]
  /** First question for each device kind, and every question by id. */
  firstQuestion: Record<DeviceKind, string>
  questions: Record<string, QuestionDef>
  states: Record<StateId, StateDef>
  /**
   * Text of fixed log entries and prompts. The engine holds no wording of its own: every
   * string it produces comes from here or from the states. Templates use {name} placeholders.
   */
  text: {
    scanPrompt: string
    scanButton: string
    scanLogged: string
    sceneSecured: string
    /** r2. e.g. {criminal: "Criminal seizure", ransomware: "Ransomware response"}. */
    scenarioLabels: Record<Scenario, string>
    /** r2. "Assessed: {state}", {state} is the state's logLabel. */
    logAssessed: string
    /** r2. "Reassessed: {from} to {to}", both are shortLabels. Used even when the state is unchanged. */
    logReassessed: string
    /** r2. "Scenario: {scenario}", {scenario} is the scenario's label. */
    logScenario: string
    /** r2. "#{rank} {name} is still waiting", {name} is the device's name. */
    nudge: string
  }
}

// ───────────────────────────── Engine (pure logic) ─────────────────────────────

export type Clock = {
  /** Milliseconds, monotonic within a session. */
  nowMs(): number
  /** Wall-clock time for log entries, "HH:MM:SS". */
  timeString(): string
}

export type LogKind = "scan" | "assessed" | "reassessed" | "fact" | "scenario"

export type LogEntry = {
  kind: LogKind
  time: string
  /** Empty for scan and scenario entries. */
  deviceId: DeviceId | ""
  /** e.g. "Signal in bag: Still showing", "Assessed: on, locked, not wiping", "Scenario: Ransomware response". */
  text: string
  /** "14:32:07, PH-01, Signal in bag: Still showing" (device part left out when deviceId is empty). */
  line: string
  // r2. For a "fact" entry, text is the fact's stem, one space, and the answer's label.
}

export type ChipStatus = "unassessed" | "assessed" | "in_progress" | "done"
export type StepStatus = "done" | "active" | "locked"

export type QuestionView = {
  id: string
  stem: string
  answers: [string, string]
}

export type StepView = {
  id: string
  /** 1-based position in the current order. */
  number: number
  /** The corrective line while a problem is open, otherwise the step text. */
  text: string
  sources: string[]
  contested: string | null
  status: StepStatus
  /** True while a problem answer is unresolved on this step. */
  problemOpen: boolean
  /** Only on the active step. */
  fact: {stem: string; answers: [string, string]} | null
}

export type DeviceView = {
  id: DeviceId
  kind: DeviceKind
  name: string
  chip: ChipStatus
  /**
   * r2. Non-null whenever the device is unassessed (from the start: there is no "begin assess"
   * call) or is being reassessed. The view hides the steps meanwhile.
   */
  question: QuestionView | null
  /** Null until assessed. */
  stateId: StateId | null
  stateLabel: string
  /** 1-based rank among assessed devices; null until assessed. */
  rank: number | null
  reason: string
  strip: {text: string; sources: string[]} | null
  steps: StepView[]
  /** Index into `steps` of the active step, or -1. */
  activeStep: number
  /** e.g. "#1 Laptop is still waiting", or null. */
  nudge: string | null
  /** Seizure clock: seconds since the device entered a state with a clock; null otherwise. */
  clockSeconds: number | null
  clockLabel: string
  clockNote: string
}

export type EngineEvent =
  | {type: "logged"; entry: LogEntry}
  /** r2. The device's pending question changed: after beginReassess, and after an answer that leads to another question. */
  | {type: "question_asked"; deviceId: DeviceId; questionId: string}
  | {type: "assessed"; deviceId: DeviceId; state: StateId; reassessed: boolean}
  | {type: "ranks_changed"}
  | {type: "step_closed"; deviceId: DeviceId; stepId: string}
  | {type: "problem"; deviceId: DeviceId; stepId: string}
  | {type: "state_switched"; deviceId: DeviceId; from: StateId; to: StateId}
  | {type: "device_done"; deviceId: DeviceId}
  | {type: "scenario_changed"; scenario: Scenario}
  | {type: "scene_secured"}

/**
 * Behaviour rules (r2). Where the brief is silent these are the reading to build and test against.
 *
 *  1. Allowed and not allowed. A call that is allowed returns at least one event. A call that is
 *     not allowed returns [] and changes nothing: answerQuestion with no pending question,
 *     answerFact with a pending question or no active step, beginReassess on a device that is
 *     unassessed or already being reassessed, setScenario to the current scenario, a second
 *     confirmScan, and every changing call once the scene is secured (secured is final).
 *  2. Nothing is gated on the room scan. Devices can be assessed before confirmScan.
 *  3. Assessing. When the question tree ends: one "assessed" log entry, then events
 *     logged, assessed, ranks_changed, in that order.
 *  4. Ranking. Tier first, then the order of FIRST assessment. A device keeps its place in that
 *     order through reassessment and state switches.
 *  5. While a device is being reassessed, stateId, stateLabel, rank, reason, strip, steps,
 *     activeStep and the clock keep reporting the old state, and question is non-null.
 *     When the tree ends: one "reassessed" log entry, then events logged, assessed (reassessed:
 *     true), and ranks_changed only if the state changed. Same state: progress, open problems
 *     and the clock are kept. Changed state: steps restart at step 1 with no problem open.
 *  6. Clock. clockSeconds counts whole seconds from the moment the device entered its current
 *     state, if that state has a clock. Leaving the state and coming back restarts it.
 *  7. Step order. Steps are done by id. The active step is the first step, in the current
 *     scenario's order, that is not done; every later step that is not done is "locked".
 *     After a scenario switch a done step can therefore sit after the active one.
 *  8. Facts. Each allowed answerFact logs exactly one "fact" entry, whatever the outcome:
 *     - no outcome: the step closes (events logged, step_closed, then device_done and
 *       scene_secured when they apply).
 *     - "problem": the step stays open. The variant is chosen now: the first variant whose
 *       `when` matches the latest answer given to that step's main fact in this state, else the
 *       variant with no `when`. Events logged, problem. While the problem is open the step's
 *       text, sources and contested come from the variant (sources fall back to the step's,
 *       contested to null) and the fact is the variant's closingFact, or the main fact again.
 *       Answering the main fact's problem answer again logs again and emits problem again.
 *     - "stay": only logged.
 *     - "switch": events logged, state_switched, ranks_changed. Steps restart in the new state.
 *       There is no "assessed" log entry for a switch.
 *     An open problem stays on its step until the step closes or the state changes, even if a
 *     scenario switch moves another step in front of it.
 *  9. Scenario switch. One "scenario" log entry; events logged, scenario_changed. Steps flagged
 *     reopenOnScenarioSwitch become not done and lose any open problem, in every device whose
 *     current state has different steps per scenario. Other steps keep their done state.
 * 10. Chip. "unassessed" until first assessed (and it stays as it was during a reassessment);
 *     "assessed" until the first fact is answered in the current state; "in_progress" after
 *     that, problem answers included; "done" when every step of the current state is done.
 * 11. Nudge. For an assessed device: the best-ranked other device that is assessed, not done and
 *     ranked above this one; otherwise null.
 * 12. getElapsedSeconds and clockSeconds are whole seconds (rounded down).
 *
 * The view calls these methods and redraws everything from getDevice after any call that
 * returns events. Every method that changes anything returns the events it caused, in order.
 */
export interface VolatileEngine {
  getScenario(): Scenario
  /** Logs one entry. Steps keep their done state by id; steps flagged reopenOnScenarioSwitch reopen. */
  setScenario(scenario: Scenario): EngineEvent[]

  isScanConfirmed(): boolean
  /** Logs one entry the first time; later calls do nothing. */
  confirmScan(): EngineEvent[]

  getDeviceIds(): DeviceId[]
  getDevice(id: DeviceId): DeviceView
  /** Assessed devices only, best rank first. Tier first, then the order of first assessment. */
  getRanking(): {deviceId: DeviceId; rank: number; reason: string}[]

  /** Answers the device's pending question. One "assessed" or "reassessed" log entry when the tree ends. */
  answerQuestion(id: DeviceId, answer: AnswerIndex): EngineEvent[]
  /** Reopens the questions. If the new state equals the old one, progress is kept; otherwise steps restart. */
  beginReassess(id: DeviceId): EngineEvent[]
  /** Answers the active step's fact. Exactly one "fact" log entry per call that is allowed. */
  answerFact(id: DeviceId, answer: AnswerIndex): EngineEvent[]

  getLog(): LogEntry[]
  /** True when every device is assessed and every step of its current state is done. */
  isSceneSecured(): boolean
  /** Seconds since the engine was created; frozen once the scene is secured. */
  getElapsedSeconds(): number
}

/** Implemented in VolatileEngine.ts: `export function createEngine(rules: Rules, clock: Clock): VolatileEngine`. */
export type CreateEngine = (rules: Rules, clock: Clock) => VolatileEngine
