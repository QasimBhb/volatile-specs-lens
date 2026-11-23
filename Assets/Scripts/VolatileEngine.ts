import type {
  AnswerIndex,
  ChipStatus,
  Clock,
  CreateEngine,
  DeviceDef,
  DeviceId,
  DeviceView,
  EngineEvent,
  FactDef,
  LogEntry,
  ProblemVariant,
  QuestionView,
  Rules,
  Scenario,
  StateDef,
  StateId,
  StepDef,
  StepStatus,
  StepView,
  VolatileEngine,
} from "./VolatileTypes"

type ActiveProblem = {
  corrective: string
  sources: string[]
  contested: string | null
  closingFact: FactDef
  isCustomClosingFact: boolean
}

type InternalDevice = {
  def: DeviceDef
  currentQuestionId: string | null
  reassessing: boolean
  stateId: StateId | null
  firstAssessedSeq: number | null
  completedSteps: Set<string>
  recordedMainAnswers: Map<string, AnswerIndex>
  openProblems: Map<string, ActiveProblem>
  startedInState: boolean
  clockStartMs: number | null
}

type RankedItem = {
  deviceId: DeviceId
  rank: number
  reason: string
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  )
}

function getScenarioSteps(stateDef: StateDef, scenario: Scenario): StepDef[] {
  if (scenario === "ransomware" && stateDef.steps.ransomware !== undefined) {
    return stateDef.steps.ransomware
  }
  return stateDef.steps.criminal
}

function getReopenStepIds(stateDef: StateDef): Set<string> {
  const ids = new Set<string>()
  if (stateDef.steps.ransomware === undefined) {
    return ids
  }
  for (const step of stateDef.steps.criminal) {
    if (step.reopenOnScenarioSwitch) {
      ids.add(step.id)
    }
  }
  for (const step of stateDef.steps.ransomware) {
    if (step.reopenOnScenarioSwitch) {
      ids.add(step.id)
    }
  }
  return ids
}

function toFactView(fact: FactDef): {stem: string; answers: [string, string]} {
  return {
    stem: fact.stem,
    answers: [fact.answers[0].label, fact.answers[1].label],
  }
}

function formatLogLine(time: string, deviceId: DeviceId | "", text: string): string {
  return deviceId === "" ? `${time}, ${text}` : `${time}, ${deviceId}, ${text}`
}

function pickProblemVariant(
  variants: ProblemVariant[],
  recordedMainAnswers: Map<string, AnswerIndex>
): ProblemVariant | undefined {
  for (const variant of variants) {
    if (
      variant.when !== undefined &&
      recordedMainAnswers.get(variant.when.stepId) === variant.when.answer
    ) {
      return variant
    }
  }
  for (const variant of variants) {
    if (variant.when === undefined) {
      return variant
    }
  }
  // Fallback when no `when` matches and no default variant (without `when`) is given.
  // Unreachable with the shipped rules, where every conditional problem is exhaustive or has a default.
  return variants[0]
}

function isValidAnswerIndex(answer: AnswerIndex): boolean {
  return answer === 0 || answer === 1
}

export function createEngine(rules: Rules, clock: Clock): VolatileEngine {
  let scenario: Scenario = "criminal"
  let scanConfirmed = false
  const startMs = clock.nowMs()
  let securedMs: number | null = null
  let nextAssessedSeq = 0

  const log: LogEntry[] = []
  const deviceMap = new Map<DeviceId, InternalDevice>()
  const deviceOrder: InternalDevice[] = []

  for (const def of rules.devices) {
    const internal: InternalDevice = {
      def: {id: def.id, kind: def.kind, name: def.name},
      currentQuestionId: rules.firstQuestion[def.kind] ?? null,
      reassessing: false,
      stateId: null,
      firstAssessedSeq: null,
      completedSteps: new Set<string>(),
      recordedMainAnswers: new Map<string, AnswerIndex>(),
      openProblems: new Map<string, ActiveProblem>(),
      startedInState: false,
      clockStartMs: null,
    }
    deviceMap.set(def.id, internal)
    deviceOrder.push(internal)
  }

  function appendLog(
    kind: LogEntry["kind"],
    deviceId: DeviceId | "",
    text: string
  ): LogEntry {
    const time = clock.timeString()
    const entry: LogEntry = {
      kind,
      time,
      deviceId,
      text,
      line: formatLogLine(time, deviceId, text),
    }
    log.push(entry)
    return {...entry}
  }

  function isDeviceDone(dev: InternalDevice): boolean {
    if (dev.stateId === null) {
      return false
    }
    const stateDef = rules.states[dev.stateId]
    if (!stateDef) {
      return false
    }
    const stepDefs = getScenarioSteps(stateDef, scenario)
    return stepDefs.every(
      (step) => dev.completedSteps.has(step.id) && !dev.openProblems.has(step.id)
    )
  }

  function computeChipStatus(dev: InternalDevice): ChipStatus {
    if (dev.stateId === null) {
      return "unassessed"
    }
    if (isDeviceDone(dev)) {
      return "done"
    }
    if (dev.startedInState) {
      return "in_progress"
    }
    return "assessed"
  }

  function computeIsSceneSecured(): boolean {
    if (deviceOrder.length === 0) {
      return false
    }
    return deviceOrder.every(
      (dev) => dev.currentQuestionId === null && isDeviceDone(dev)
    )
  }

  function computeSortedAssessed(): InternalDevice[] {
    const assessed = deviceOrder.filter((dev) => dev.stateId !== null)
    assessed.sort((a, b) => {
      const tierA = rules.states[a.stateId!].tier
      const tierB = rules.states[b.stateId!].tier
      if (tierA !== tierB) {
        return tierA - tierB
      }
      return (a.firstAssessedSeq ?? 0) - (b.firstAssessedSeq ?? 0)
    })
    return assessed
  }

  function computeRanking(): RankedItem[] {
    const sorted = computeSortedAssessed()
    return sorted.map((dev, idx) => ({
      deviceId: dev.def.id,
      rank: idx + 1,
      reason: rules.states[dev.stateId!].reason,
    }))
  }

  function getQuestionView(questionId: string | null): QuestionView | null {
    if (questionId === null) {
      return null
    }
    const qDef = rules.questions[questionId]
    if (!qDef) {
      return null
    }
    return {
      id: qDef.id,
      stem: qDef.stem,
      answers: [qDef.answers[0].label, qDef.answers[1].label],
    }
  }

  function resetStateProgress(dev: InternalDevice, newStateDef: StateDef): void {
    dev.completedSteps.clear()
    dev.recordedMainAnswers.clear()
    dev.openProblems.clear()
    dev.startedInState = false
    if (newStateDef.clock !== undefined) {
      dev.clockStartMs = clock.nowMs()
    } else {
      dev.clockStartMs = null
    }
  }

  function computeNudge(dev: InternalDevice, myRank: number | null): string | null {
    if (dev.stateId === null || myRank === null) {
      return null
    }
    const sorted = computeSortedAssessed()
    for (let i = 0; i < sorted.length; i++) {
      const candidateRank = i + 1
      if (candidateRank >= myRank) {
        break
      }
      const candidate = sorted[i]
      if (!isDeviceDone(candidate)) {
        return renderTemplate(rules.text.nudge, {
          rank: String(candidateRank),
          name: candidate.def.name,
        })
      }
    }
    return null
  }

  function buildStepsAndActiveIndex(
    dev: InternalDevice,
    stateDef: StateDef
  ): {steps: StepView[]; activeStep: number} {
    const stepDefs = getScenarioSteps(stateDef, scenario)
    let activeStep = -1
    const steps: StepView[] = []

    for (let i = 0; i < stepDefs.length; i++) {
      const stepDef = stepDefs[i]
      const openProb = dev.openProblems.get(stepDef.id)
      const isDone = dev.completedSteps.has(stepDef.id) && openProb === undefined

      let status: StepStatus
      if (isDone) {
        status = "done"
      } else if (activeStep === -1) {
        status = "active"
        activeStep = i
      } else {
        status = "locked"
      }

      const activeFactDef = openProb !== undefined ? openProb.closingFact : stepDef.fact
      steps.push({
        id: stepDef.id,
        number: i + 1,
        text: openProb !== undefined ? openProb.corrective : stepDef.text,
        sources:
          openProb !== undefined ? [...openProb.sources] : [...stepDef.sources],
        contested:
          openProb !== undefined ? openProb.contested : (stepDef.contested ?? null),
        status,
        problemOpen: openProb !== undefined,
        fact: status === "active" ? toFactView(activeFactDef) : null,
      })
    }

    return {steps, activeStep}
  }

  return {
    getScenario(): Scenario {
      return scenario
    },

    setScenario(nextScenario: Scenario): EngineEvent[] {
      if (securedMs !== null) {
        return []
      }
      if (nextScenario !== "criminal" && nextScenario !== "ransomware") {
        return []
      }
      if (nextScenario === scenario) {
        return []
      }

      scenario = nextScenario

      for (const dev of deviceOrder) {
        if (dev.stateId === null) {
          continue
        }
        const stateDef = rules.states[dev.stateId]
        if (!stateDef) {
          continue
        }
        const reopenIds = getReopenStepIds(stateDef)
        for (const stepId of reopenIds) {
          dev.completedSteps.delete(stepId)
          dev.openProblems.delete(stepId)
          dev.recordedMainAnswers.delete(stepId)
        }
      }

      const entry = appendLog(
        "scenario",
        "",
        renderTemplate(rules.text.logScenario, {
          scenario: rules.text.scenarioLabels[scenario],
        })
      )
      const events: EngineEvent[] = [
        {type: "logged", entry},
        {type: "scenario_changed", scenario},
      ]

      if (computeIsSceneSecured()) {
        securedMs = clock.nowMs()
        events.push({type: "scene_secured"})
      }

      return events
    },

    isScanConfirmed(): boolean {
      return scanConfirmed
    },

    confirmScan(): EngineEvent[] {
      if (securedMs !== null || scanConfirmed) {
        return []
      }
      scanConfirmed = true
      const entry = appendLog("scan", "", rules.text.scanLogged)
      return [{type: "logged", entry}]
    },

    getDeviceIds(): DeviceId[] {
      return deviceOrder.map((dev) => dev.def.id)
    },

    getDevice(id: DeviceId): DeviceView {
      const dev = deviceMap.get(id)
      // Read query throws on an unknown DeviceId; mutating methods treat unknown IDs as disallowed and return [].
      if (!dev) {
        throw new Error(String(id))
      }

      const question = getQuestionView(dev.currentQuestionId)

      if (dev.stateId === null) {
        return {
          id: dev.def.id,
          kind: dev.def.kind,
          name: dev.def.name,
          chip: "unassessed",
          question,
          stateId: null,
          stateLabel: "",
          rank: null,
          reason: "",
          strip: null,
          steps: [],
          activeStep: -1,
          nudge: null,
          clockSeconds: null,
          clockLabel: "",
          clockNote: "",
        }
      }

      const stateDef = rules.states[dev.stateId]
      const ranking = computeRanking()
      const rankEntry = ranking.find((r) => r.deviceId === dev.def.id)
      const rank = rankEntry ? rankEntry.rank : null
      const {steps, activeStep} = buildStepsAndActiveIndex(dev, stateDef)

      let clockSeconds: number | null = null
      let clockLabel = ""
      let clockNote = ""
      if (stateDef.clock !== undefined && dev.clockStartMs !== null) {
        const endMs = securedMs ?? clock.nowMs()
        clockSeconds = Math.max(
          0,
          Math.floor((endMs - dev.clockStartMs) / 1000)
        )
        clockLabel = stateDef.clock.label
        clockNote = stateDef.clock.note
      }

      return {
        id: dev.def.id,
        kind: dev.def.kind,
        name: dev.def.name,
        chip: computeChipStatus(dev),
        question,
        stateId: dev.stateId,
        stateLabel: stateDef.label,
        rank,
        reason: stateDef.reason,
        strip: {
          text: stateDef.strip.text,
          sources: [...stateDef.strip.sources],
        },
        steps,
        activeStep,
        nudge: computeNudge(dev, rank),
        clockSeconds,
        clockLabel,
        clockNote,
      }
    },

    getRanking(): {deviceId: DeviceId; rank: number; reason: string}[] {
      return computeRanking()
    },

    answerQuestion(id: DeviceId, answer: AnswerIndex): EngineEvent[] {
      if (securedMs !== null) {
        return []
      }
      const dev = deviceMap.get(id)
      if (!dev || dev.currentQuestionId === null || !isValidAnswerIndex(answer)) {
        return []
      }
      const qDef = rules.questions[dev.currentQuestionId]
      if (!qDef) {
        return []
      }
      const chosen = qDef.answers[answer]
      if (!chosen) {
        return []
      }

      if ("question" in chosen.next) {
        const nextQuestionId = chosen.next.question
        if (!rules.questions[nextQuestionId]) {
          return []
        }
        dev.currentQuestionId = nextQuestionId
        return [
          {
            type: "question_asked",
            deviceId: dev.def.id,
            questionId: nextQuestionId,
          },
        ]
      }

      const targetStateId = chosen.next.state
      const targetStateDef = rules.states[targetStateId]
      if (!targetStateDef) {
        return []
      }

      const wasReassessing = dev.reassessing
      const oldStateId = dev.stateId

      dev.currentQuestionId = null
      dev.reassessing = false

      const events: EngineEvent[] = []

      if (!wasReassessing || oldStateId === null) {
        dev.stateId = targetStateId
        dev.firstAssessedSeq = nextAssessedSeq++
        resetStateProgress(dev, targetStateDef)

        const entry = appendLog(
          "assessed",
          dev.def.id,
          renderTemplate(rules.text.logAssessed, {
            state: targetStateDef.logLabel,
          })
        )
        events.push({type: "logged", entry})
        events.push({
          type: "assessed",
          deviceId: dev.def.id,
          state: targetStateId,
          reassessed: false,
        })
        events.push({type: "ranks_changed"})

        if (isDeviceDone(dev)) {
          events.push({type: "device_done", deviceId: dev.def.id})
          if (computeIsSceneSecured()) {
            securedMs = clock.nowMs()
            events.push({type: "scene_secured"})
          }
        }
        return events
      }

      const oldStateDef = rules.states[oldStateId]
      const stateChanged = targetStateId !== oldStateId
      if (stateChanged) {
        dev.stateId = targetStateId
        resetStateProgress(dev, targetStateDef)
      }

      const entry = appendLog(
        "reassessed",
        dev.def.id,
        renderTemplate(rules.text.logReassessed, {
          from: oldStateDef.shortLabel,
          to: targetStateDef.shortLabel,
        })
      )
      events.push({type: "logged", entry})
      events.push({
        type: "assessed",
        deviceId: dev.def.id,
        state: targetStateId,
        reassessed: true,
      })

      if (stateChanged) {
        events.push({type: "ranks_changed"})
        if (isDeviceDone(dev)) {
          events.push({type: "device_done", deviceId: dev.def.id})
        }
      }

      if (computeIsSceneSecured()) {
        securedMs = clock.nowMs()
        events.push({type: "scene_secured"})
      }

      return events
    },

    beginReassess(id: DeviceId): EngineEvent[] {
      if (securedMs !== null) {
        return []
      }
      const dev = deviceMap.get(id)
      if (!dev || dev.stateId === null || dev.currentQuestionId !== null) {
        return []
      }
      const firstQId = rules.firstQuestion[dev.def.kind]
      if (!firstQId || !rules.questions[firstQId]) {
        return []
      }
      dev.reassessing = true
      dev.currentQuestionId = firstQId
      return [
        {
          type: "question_asked",
          deviceId: dev.def.id,
          questionId: firstQId,
        },
      ]
    },

    answerFact(id: DeviceId, answer: AnswerIndex): EngineEvent[] {
      if (securedMs !== null) {
        return []
      }
      const dev = deviceMap.get(id)
      if (
        !dev ||
        dev.stateId === null ||
        dev.currentQuestionId !== null ||
        !isValidAnswerIndex(answer)
      ) {
        return []
      }

      const stateDef = rules.states[dev.stateId]
      if (!stateDef) {
        return []
      }

      const stepDefs = getScenarioSteps(stateDef, scenario)
      const activeStepDef = stepDefs.find(
        (step) =>
          !dev.completedSteps.has(step.id) || dev.openProblems.has(step.id)
      )
      if (!activeStepDef) {
        return []
      }

      const openProb = dev.openProblems.get(activeStepDef.id)
      const activeFact =
        openProb !== undefined ? openProb.closingFact : activeStepDef.fact
      const chosen = activeFact.answers[answer]
      if (!chosen) {
        return []
      }

      if (openProb === undefined || !openProb.isCustomClosingFact) {
        dev.recordedMainAnswers.set(activeStepDef.id, answer)
      }

      dev.startedInState = true
      const entry = appendLog(
        "fact",
        dev.def.id,
        `${activeFact.stem} ${chosen.label}`
      )
      const events: EngineEvent[] = [{type: "logged", entry}]

      const outcome = chosen.outcome
      if (outcome === undefined) {
        dev.openProblems.delete(activeStepDef.id)
        dev.completedSteps.add(activeStepDef.id)
        events.push({
          type: "step_closed",
          deviceId: dev.def.id,
          stepId: activeStepDef.id,
        })

        if (isDeviceDone(dev)) {
          events.push({type: "device_done", deviceId: dev.def.id})
          if (computeIsSceneSecured()) {
            securedMs = clock.nowMs()
            events.push({type: "scene_secured"})
          }
        }
        return events
      }

      if (outcome.kind === "stay") {
        return events
      }

      if (outcome.kind === "problem") {
        const variant = pickProblemVariant(
          outcome.variants,
          dev.recordedMainAnswers
        )
        if (variant !== undefined) {
          dev.openProblems.set(activeStepDef.id, {
            corrective: variant.corrective,
            sources:
              variant.sources !== undefined
                ? [...variant.sources]
                : [...activeStepDef.sources],
            contested: variant.contested ?? null,
            closingFact: variant.closingFact ?? activeStepDef.fact,
            isCustomClosingFact: variant.closingFact !== undefined,
          })
        }
        events.push({
          type: "problem",
          deviceId: dev.def.id,
          stepId: activeStepDef.id,
        })
        return events
      }

      if (outcome.kind === "switch") {
        const fromState = dev.stateId
        const toState = outcome.state
        const toStateDef = rules.states[toState]
        if (!toStateDef) {
          return events
        }

        dev.stateId = toState
        resetStateProgress(dev, toStateDef)

        events.push({
          type: "state_switched",
          deviceId: dev.def.id,
          from: fromState,
          to: toState,
        })
        events.push({type: "ranks_changed"})

        if (isDeviceDone(dev)) {
          events.push({type: "device_done", deviceId: dev.def.id})
          if (computeIsSceneSecured()) {
            securedMs = clock.nowMs()
            events.push({type: "scene_secured"})
          }
        }
        return events
      }

      return events
    },

    getLog(): LogEntry[] {
      return log.map((entry) => ({...entry}))
    },

    isSceneSecured(): boolean {
      return securedMs !== null
    },

    getElapsedSeconds(): number {
      const endMs = securedMs ?? clock.nowMs()
      return Math.max(0, Math.floor((endMs - startMs) / 1000))
    },
  }
}

const _typeCheckCreateEngine: CreateEngine = createEngine
void _typeCheckCreateEngine
