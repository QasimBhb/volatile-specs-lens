import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {createEngine} from "./VolatileEngine"
import {VOLATILE_RULES} from "./VolatileRules"
import {AnswerIndex, ChipStatus, DeviceId, DeviceView, EngineEvent, LogEntry, Scenario, StepView, VolatileEngine} from "./VolatileTypes"
import {
  AMBER,
  ASSESSED_BORDER,
  BADGE_RED,
  CHECK,
  CHIP_FILL,
  CRIMSON_A,
  CRIMSON_B,
  CYAN,
  DIM,
  GREEN,
  GREEN_A,
  GREEN_B,
  GREEN_BORDER,
  GREY_BORDER,
  PLATE_A,
  PLATE_B,
  PLATE_EDGE,
  RED_BORDER,
  RED_TEXT,
  ROW_ACTIVE,
  SOFT,
  T_BODY,
  T_CAPTION,
  T_LARGE,
  UiButton,
  WHITE,
  basis,
  button,
  buttonReady,
  child,
  faceCamera,
  hms,
  lineHeight,
  ms,
  pad2,
  panel,
  placePanel,
  placeText,
  setFitted,
  setLine,
  setWrapped,
  text,
  viewUp
} from "./VolatileUi"

/**
 * Volatile, version 2: the view.
 *
 * Asks a few state questions about each device, ranks the assessed devices by urgency, and puts
 * the next safe steps and a "never do" warning on the device itself. Every answer is logged.
 *
 * All behaviour lives in the engine (VolatileEngine.ts) and all wording in the rules
 * (VolatileRules.ts). This script only draws what the engine reports and passes pinches to it:
 * after any call that returns events, everything is redrawn from engine.getDevice().
 *
 * Gaze dwell stands in for object recognition: looking at a stand-in for about a second traces
 * a ring and opens its card. The scene object this script sits on has its origin at the centre
 * of the desk top; +X right, +Y up, +Z toward the responder.
 */

/** Where a device's tag and card sit, as offsets from its stand-in, in desk axes (cm). */
type DeviceLayout = {
  /** Centre of the tag row (rank marker plus reason pill or "never do" strip). */
  tagCenter: vec3
  tagWidth: number
  /** Which end of the tag row the marker sits at: -1 left, 1 right. */
  markerSide: number
  /** Bottom-centre of the card. Cards grow upward from here. */
  cardBottom: vec3
  /** Centre and radius of the gaze target and scan ring. */
  gazeCenter: vec3
  gazeRadius: number
}

const LAYOUT: {[id: string]: DeviceLayout} = {
  // Strip along the top edge of the lid; card to the right of the lid.
  "LAP-01": {tagCenter: new vec3(0, 28.6, -8.5), tagWidth: 33, markerSide: -1, cardBottom: new vec3(29, 2, -10), gazeCenter: new vec3(0, 11, -8), gazeRadius: 21},
  // Tag above the antennas; card to the left (the router is at the end of the desk). The card must
  // stay right of x = 16.5 on the desk, or the laptop's lid cuts across its left edge.
  "NET-01": {tagCenter: new vec3(0, 17.8, -5), tagWidth: 24, markerSide: -1, cardBottom: new vec3(-22.5, 4, -6), gazeCenter: new vec3(0, 6, 0), gazeRadius: 13},
  // Marker over the phone, pill and strip running left; card to the right.
  "PH-01": {tagCenter: new vec3(-8.25, 6, -11), tagWidth: 24, markerSide: 1, cardBottom: new vec3(14.75, 2, -9), gazeCenter: new vec3(0, 2, 0), gazeRadius: 10},
  // Marker over the drive, pill and strip running right; card to the left.
  "USB-01": {tagCenter: new vec3(9.2, 5, 0), tagWidth: 24, markerSide: -1, cardBottom: new vec3(-13.8, 2, -8), gazeCenter: new vec3(-0.8, 1.5, 0), gazeRadius: 8}
}

/** Words that belong to the view itself. Everything else comes from the rules. */
const LABELS = {
  notAssessed: "NOT ASSESSED",
  reassessing: "REASSESSING",
  log: "Log",
  logTitle: "CUSTODY LOG",
  logEmpty: "No entries yet.",
  totalTime: "Total time",
  contested: "Contested",
  reassess: "Reassess",
  scenario: "SCENARIO · PINCH TO SWITCH"
}

const MARKER = 5.6
const TAG_GAP = 0.6
const CARD_W = 20
const PAD = 1
const INNER_W = CARD_W - PAD * 2
const ACTIVE_W = INNER_W - 0.9
const ACTIVE_X = 0.45
const BTN_W = 8.6
const BTN_H = 5
const REASSESS_H = 4.5
/** One curve and one duration for all motion: about 160 ms, ease-out. */
const MOTION_S = 0.16
const ROW_H = 1.85
const LINE_BODY = lineHeight(T_BODY)
const LINE_CAPTION = lineHeight(T_CAPTION)
const SOURCE_JOIN = "  ·  "
const MAX_STEPS = 4
const RING_SEGMENTS = 48
/** A device further than this from the centre of view counts as out of view. */
const OUT_OF_VIEW_DEG = 20
const LOG_W = 36
const LOG_LINES = 9
const LOG_CHARS = 72
const HIDDEN = new vec3(0.001, 0.001, 0.001)
const ONE = new vec3(1, 1, 1)

type DeviceUI = {
  id: DeviceId
  layout: DeviceLayout
  standIn: SceneObject
  /** Stand-in position in desk space. */
  origin: vec3

  tagRoot: SceneObject
  markerRoot: SceneObject
  markerPlate: RoundedRectangle
  markerNumeral: Text
  markerFoot: RoundedRectangle
  markerCheck: Text
  pillRoot: SceneObject
  pillPlate: RoundedRectangle
  pillReason: Text
  pillClock: Text
  stripRoot: SceneObject
  stripPlate: RoundedRectangle
  stripBadge: RoundedRectangle
  stripMark: Text
  stripHeadline: Text
  stripSource: Text
  arrowRoot: SceneObject

  cardRoot: SceneObject
  content: SceneObject
  plate: RoundedRectangle
  headerId: Text
  headerState: Text
  headerRule: RoundedRectangle
  reason: Text
  clock: Text
  clockNote: Text
  questionStem: Text
  activeGroup: SceneObject
  activeRow: RoundedRectangle
  activeBar: RoundedRectangle
  activeText: Text
  rows: Text[]
  sourceChip: RoundedRectangle
  sourceText: Text
  contestedChip: RoundedRectangle
  contestedText: Text
  contestedNote: Text
  factStem: Text
  answerA: UiButton
  answerB: UiButton
  footerRule: RoundedRectangle
  custody: Text
  nudge: Text
  reassess: UiButton

  cardHeight: number
  /** Top of the active-step group on the card. */
  groupY: number
  ringTraced: boolean
  lastClock: number
  lastRank: number | null
  /** Motion progress, 0 to 1. 1 means at rest. */
  openAnim: number
  popAnim: number
  pulseAnim: number
}

@component
export class VolatileView extends BaseScriptComponent {
  @ui.label("Volatile, version 2: state-based guidance")
  @ui.separator
  @ui.group_start("Scene references")
  @input
  @hint("Camera scene object. Its pose is the responder's gaze.")
  cameraObject: SceneObject

  @input
  @hint("Laptop LAP-01 stand-in (preview stand-in for object recognition).")
  laptop: SceneObject

  @input
  @hint("Router NET-01 stand-in (preview stand-in for object recognition).")
  router: SceneObject

  @input
  @hint("Phone PH-01 stand-in (preview stand-in for object recognition).")
  phone: SceneObject

  @input
  @hint("USB drive USB-01 stand-in (preview stand-in for object recognition).")
  usb: SceneObject

  @input
  @hint("Unit box mesh used for the scan ring.")
  boxMesh: RenderMesh

  @input
  @hint("Unlit material, cloned and tinted for the scan ring.")
  uiMaterial: Material
  @ui.group_end

  @ui.group_start("Gaze dwell (stands in for recognition)")
  @input
  @widget(new SliderWidget(0.3, 3, 0.1))
  @hint("Seconds of gaze on a device before its card opens.")
  dwellSeconds: number = 1.0

  @input
  @widget(new SliderWidget(0.5, 4, 0.05))
  @hint("Seconds of looking clearly away before the card collapses to the chip.")
  collapseSeconds: number = 1.75

  @input
  @widget(new SliderWidget(50, 400, 10))
  @hint("Maximum distance (cm) at which a device can be scanned.")
  scanRangeCm: number = 200

  @input
  @widget(new SliderWidget(0, 15, 0.5))
  @hint("Extra degrees around a device that still count as looking at it.")
  gazeMarginDeg: number = 4
  @ui.group_end

  @ui.group_start("Stand-ins")
  @input
  @hint("Dim the stand-in shapes and add flat screens, so the interface is the brightest thing in view.")
  dressStandIns: boolean = true
  @ui.group_end

  @ui.group_start("Sound")
  @input
  @allowUndefined
  @hint("Soft click played for each answer.")
  clickSound: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Chime played when a device is finished and when the scene is secured.")
  chimeSound: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Low, short tone played when an answer reveals a problem.")
  problemSound: AudioTrackAsset
  @ui.group_end

  @ui.group_start("Developer")
  @input
  @hint("Actions replayed at start, for captures. Leave empty. Example: scan; look NET-01; a; look PH-01; a; a; b; away; log")
  debugSteps: string = ""
  @ui.group_end

  private engine: VolatileEngine
  private uiRoot: SceneObject
  private devices: DeviceUI[] = []
  private facers: Transform[] = []
  private camTransform: Transform

  private ringRoot: SceneObject
  private ringSegments: SceneObject[] = []
  private ringProgress: number = 0

  private scanRoot: SceneObject
  private scanButton: UiButton
  private logChip: UiButton
  private logRoot: SceneObject
  private logTitle: Text
  private logBody: Text
  private logOpen: boolean = false
  private bannerRoot: SceneObject
  private bannerSub: Text
  private bannerText: string = ""
  private scenarioToggle: UiButton
  private lastFinished: DeviceUI | null = null
  private laptopFace: SceneObject | null = null
  private phoneFace: SceneObject | null = null
  private phoneLockHint: SceneObject | null = null
  private routerLights: SceneObject | null = null

  private clickAudio: AudioComponent
  private chimeAudio: AudioComponent
  private problemAudio: AudioComponent

  private openDev: DeviceUI | null = null
  private dwellDev: DeviceUI | null = null
  private dwellTimer: number = 0
  private awayTimer: number = 0
  private ready: boolean = false
  private initFrames: number = 0

  // Simulated gaze, used by tests because LEAF cannot move the responder's head.
  private simulatedGazeActive: boolean = false
  private simulatedGaze: DeviceUI | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      try {
        this.build()
      } catch (e) {
        print("[Volatile] build failed: " + e)
      }
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ───────────────────────────── Build ─────────────────────────────

  private build(): void {
    this.camTransform = this.cameraObject.getTransform()
    this.engine = createEngine(VOLATILE_RULES, {
      nowMs: () => getTime() * 1000,
      timeString: () => {
        const d = new Date()
        return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds())
      }
    })

    if (this.dressStandIns) this.dressScene()

    this.uiRoot = child(this.sceneObject, "Volatile UI", new vec3(0, 0, 0))
    const standIns: {[id: string]: SceneObject} = {"LAP-01": this.laptop, "NET-01": this.router, "PH-01": this.phone, "USB-01": this.usb}
    for (const id of this.engine.getDeviceIds()) {
      if (!LAYOUT[id] || !standIns[id]) {
        print("[Volatile] no layout or stand-in for " + id)
        continue
      }
      this.devices.push(this.buildDevice(id, LAYOUT[id], standIns[id]))
    }
    this.buildRing()
    this.buildScanPrompt()
    this.buildLog()
    this.buildScenarioToggle()
    this.buildBanner()

    this.clickAudio = this.audio(this.clickSound)
    this.chimeAudio = this.audio(this.chimeSound)
    this.problemAudio = this.audio(this.problemSound)

    this.redrawAll()
    this.updateFacing()
  }

  private audio(track: AudioTrackAsset): AudioComponent {
    const a = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    if (track) a.audioTrack = track
    return a
  }

  private buildDevice(id: DeviceId, layout: DeviceLayout, standIn: SceneObject): DeviceUI {
    const origin = standIn.getTransform().getLocalPosition()

    // ── Tag row: rank marker, plus the reason pill (card closed) or the "never do" strip (card open).
    const tagRoot = child(this.uiRoot, "Tag " + id, origin.add(layout.tagCenter))
    this.facers.push(tagRoot.getTransform())
    const side = layout.markerSide
    const restW = layout.tagWidth - MARKER - TAG_GAP
    const markerX = side * (layout.tagWidth / 2 - MARKER / 2)
    const restX = -side * (layout.tagWidth / 2 - restW / 2)

    const markerRoot = child(tagRoot, "RankMarker " + id, new vec3(markerX, 0, 0))
    markerRoot.createComponent("Component.Canvas")
    const markerPlate = panel(markerRoot, "Marker Plate", MARKER, MARKER, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: GREY_BORDER, borderSize: 0.22, radius: 0.6})
    const markerNumeral = text(markerRoot, "Marker Numeral", "?", T_LARGE, true, WHITE, MARKER, 3, new vec3(0, 0.35, 0.1), HorizontalAlignment.Center, false)
    const markerFoot = panel(markerRoot, "Marker Foot", 2.6, 0.32, new vec3(0, -1.75, 0.1), {fill: GREY_BORDER, radius: 0.16})
    const markerCheck = text(markerRoot, "Marker Check", CHECK, T_CAPTION, true, GREEN, MARKER, 1.4, new vec3(0, -1.7, 0.1), HorizontalAlignment.Center, false)

    const pillRoot = child(tagRoot, "ReasonPill " + id, new vec3(restX, 0, 0))
    pillRoot.createComponent("Component.Canvas")
    const pillPlate = panel(pillRoot, "Pill Plate", restW, MARKER, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 0.9})
    const pillReason = text(pillRoot, "Pill Reason", "", T_CAPTION, false, WHITE, restW - 1.6, 1.6, new vec3(0, 0, 0.1), HorizontalAlignment.Left, true)
    const pillClock = text(pillRoot, "Pill Clock", "", T_CAPTION, true, AMBER, restW - 1.6, 1.6, new vec3(0, 0, 0.1), HorizontalAlignment.Left, false)

    const stripRoot = child(tagRoot, "NeverDoStrip " + id, new vec3(restX, 0, 0))
    stripRoot.createComponent("Component.Canvas")
    const stripPlate = panel(stripRoot, "Strip Plate", restW, MARKER, new vec3(0, 0, 0), {gradient: [CRIMSON_A, CRIMSON_B], border: RED_BORDER, borderSize: 0.16, radius: 0.9})
    const stripBadge = panel(stripRoot, "Warning Badge", 2.6, 2.6, new vec3(-restW / 2 + 2.3, 0.75, 0.1), {fill: BADGE_RED, border: RED_BORDER, borderSize: 0.14, radius: 1.3})
    const stripMark = text(stripRoot, "Warning Mark", "!", T_BODY, true, WHITE, 2.6, 2.6, new vec3(-restW / 2 + 2.3, 0.75, 0.2), HorizontalAlignment.Center, false)
    const stripHeadline = text(stripRoot, "Strip Headline", "", T_BODY, true, WHITE, restW - 5, 2, new vec3(1.9, 0.85, 0.1), HorizontalAlignment.Left, true)
    const stripSource = text(stripRoot, "Strip Source", "", T_CAPTION, false, RED_TEXT, restW - 5, 1.6, new vec3(1.9, -1.45, 0.1), HorizontalAlignment.Left, false)

    // ── Card: questions first, then the steps. Canvas on the root and the plate first, so the
    // plate always draws before the content on top of it.
    const cardRoot = child(this.uiRoot, "Card " + id, origin.add(layout.cardBottom))
    cardRoot.createComponent("Component.Canvas")
    this.facers.push(cardRoot.getTransform())
    const content = child(cardRoot, "Card Content", new vec3(0, 10, 0))
    const plate = panel(content, "Card Plate", CARD_W, 10, new vec3(0, -5, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 1.2})

    const headerId = text(content, "Header Id", id, T_BODY, true, WHITE, INNER_W, 1.8, new vec3(0, 0, 0.2), HorizontalAlignment.Left, false)
    const headerState = text(content, "Header State", "", T_CAPTION, true, DIM, INNER_W, 1.8, new vec3(0, 0, 0.2), HorizontalAlignment.Right, false)
    const headerRule = panel(content, "Header Rule", INNER_W, 0.08, new vec3(0, 0, 0.2), {fill: PLATE_EDGE, radius: 0.04})
    const reason = text(content, "Reason", "", T_CAPTION, false, DIM, INNER_W, 1.6, new vec3(0, 0, 0.2), HorizontalAlignment.Left, true)
    const clock = text(content, "Clock", "", T_CAPTION, true, AMBER, INNER_W, 1.6, new vec3(0, 0, 0.2), HorizontalAlignment.Left, false)
    const clockNote = text(content, "Clock Note", "", T_CAPTION, false, DIM, INNER_W, 1.6, new vec3(0, 0, 0.2), HorizontalAlignment.Left, true)
    const questionStem = text(content, "Question", "", T_BODY, true, WHITE, INNER_W, 2, new vec3(0, 0, 0.2), HorizontalAlignment.Left, true)

    // The active step is one group, so it can pulse forward as a whole. It also holds the two
    // answer buttons, which the state questions reuse.
    const activeGroup = child(content, "Active Step", new vec3(0, 0, 0))
    const activeRow = panel(activeGroup, "Active Row", CARD_W - 0.8, 10, new vec3(0, 0, 0.15), {fill: ROW_ACTIVE, radius: 0.6})
    const activeBar = panel(activeGroup, "Active Bar", 0.34, 9, new vec3(-CARD_W / 2 + 0.75, 0, 0.25), {fill: CYAN, radius: 0.17})
    const activeText = text(activeGroup, "Active Text", "", T_BODY, true, WHITE, ACTIVE_W, 1.8, new vec3(ACTIVE_X, 0, 0.3), HorizontalAlignment.Left, true)
    const sourceChip = panel(activeGroup, "Source Chip", 8, 1.7, new vec3(0, 0, 0.3), {fill: CHIP_FILL, border: GREY_BORDER, borderSize: 0.07, radius: 0.85})
    const sourceText = text(activeGroup, "Source Text", "", T_CAPTION, false, DIM, 8, 1.6, new vec3(0, 0, 0.4), HorizontalAlignment.Center, false)
    const contestedChip = panel(activeGroup, "Contested Chip", 6, 1.7, new vec3(0, 0, 0.3), {fill: CHIP_FILL, border: AMBER, borderSize: 0.09, radius: 0.85})
    const contestedText = text(activeGroup, "Contested Text", LABELS.contested, T_CAPTION, true, AMBER, 6, 1.6, new vec3(0, 0, 0.4), HorizontalAlignment.Center, false)
    const contestedNote = text(activeGroup, "Contested Note", "", T_CAPTION, false, AMBER, ACTIVE_W, 1.6, new vec3(ACTIVE_X, 0, 0.3), HorizontalAlignment.Left, true)
    const factStem = text(activeGroup, "Fact Stem", "", T_CAPTION, true, WHITE, ACTIVE_W, 1.6, new vec3(ACTIVE_X, 0, 0.3), HorizontalAlignment.Left, false)

    const rows: Text[] = []
    for (let i = 0; i < MAX_STEPS; i++) {
      rows.push(text(content, "Step " + (i + 1), "", T_BODY, false, DIM, INNER_W, 1.8, new vec3(0, 0, 0.3), HorizontalAlignment.Left, false))
    }

    const footerRule = panel(content, "Footer Rule", INNER_W, 0.08, new vec3(0, 0, 0.2), {fill: PLATE_EDGE, radius: 0.04})
    const custody = text(content, "Custody Line", "", T_CAPTION, false, SOFT, INNER_W, 1.6, new vec3(0, 0, 0.2), HorizontalAlignment.Left, true)
    const nudge = text(content, "Nudge Line", "", T_CAPTION, true, AMBER, INNER_W, 1.6, new vec3(0, 0, 0.2), HorizontalAlignment.Left, true)

    // Arrow on a finished device's tag, pointing at the next device when that one is out of view.
    const arrowRoot = child(tagRoot, "NextArrow " + id, new vec3(markerX, MARKER / 2 + 2.2, 0.1))
    panel(arrowRoot, "Arrow Shaft", 3.4, 0.5, new vec3(-0.3, 0, 0), {fill: WHITE, radius: 0.25})
    const headA = panel(arrowRoot, "Arrow Head A", 1.9, 0.5, new vec3(1, 0.5, 0), {fill: WHITE, radius: 0.25})
    const headB = panel(arrowRoot, "Arrow Head B", 1.9, 0.5, new vec3(1, -0.5, 0), {fill: WHITE, radius: 0.25})
    headA.getSceneObject().getTransform().setLocalRotation(quat.angleAxis(-0.7, vec3.forward()))
    headB.getSceneObject().getTransform().setLocalRotation(quat.angleAxis(0.7, vec3.forward()))
    arrowRoot.enabled = false

    const dev: DeviceUI = {
      id,
      layout,
      standIn,
      origin,
      tagRoot,
      markerRoot,
      markerPlate,
      markerNumeral,
      markerFoot,
      markerCheck,
      pillRoot,
      pillPlate,
      pillReason,
      pillClock,
      stripRoot,
      stripPlate,
      stripBadge,
      stripMark,
      stripHeadline,
      stripSource,
      arrowRoot,
      cardRoot,
      content,
      plate,
      headerId,
      headerState,
      headerRule,
      reason,
      clock,
      clockNote,
      questionStem,
      activeGroup,
      activeRow,
      activeBar,
      activeText,
      rows,
      sourceChip,
      sourceText,
      contestedChip,
      contestedText,
      contestedNote,
      factStem,
      answerA: null,
      answerB: null,
      footerRule,
      custody,
      nudge,
      reassess: null,
      cardHeight: 10,
      groupY: 0,
      ringTraced: false,
      lastClock: -1,
      lastRank: null,
      openAnim: 1,
      popAnim: 1,
      pulseAnim: 1
    }

    // Two answer buttons per device, reused for state questions, facts and closing facts.
    const bx = (BTN_W + 0.8) / 2
    dev.answerA = button(activeGroup, "AnswerA " + id, "", BTN_W, BTN_H, new vec3(ACTIVE_X - bx + 0.1, 0, 0.6), () => this.onAnswer(dev, 0))
    dev.answerB = button(activeGroup, "AnswerB " + id, "", BTN_W, BTN_H, new vec3(ACTIVE_X + bx - 0.1, 0, 0.6), () => this.onAnswer(dev, 1))
    // Reassess: a small capsule in the card's footer.
    dev.reassess = button(content, "Reassess " + id, LABELS.reassess, BTN_W, REASSESS_H, new vec3(0, 0, 0.6), () => this.onReassess(dev))

    // Keep UI Kit buttons enabled (but invisibly small) until they have initialised.
    cardRoot.getTransform().setLocalScale(HIDDEN)
    return dev
  }

  private buildRing(): void {
    this.ringRoot = child(this.uiRoot, "ScanRing", new vec3(0, 0, 0))
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const seg = child(this.ringRoot, "Ring Segment", new vec3(0, 0, 0))
      const rmv = seg.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = this.boxMesh
      const mat = this.uiMaterial.clone()
      mat.mainPass.baseColor = CYAN
      rmv.clearMaterials()
      rmv.addMaterial(mat)
      seg.enabled = false
      this.ringSegments.push(seg)
    }
    this.ringRoot.enabled = false
  }

  /** Scan prompt: on the desk, centre-front, at start. */
  private buildScanPrompt(): void {
    const t = VOLATILE_RULES.text
    const w = 36
    const h = 11.4
    this.scanRoot = child(this.uiRoot, "ScanPrompt", new vec3(0, 7.5, 22))
    this.scanRoot.createComponent("Component.Canvas")
    this.facers.push(this.scanRoot.getTransform())
    panel(this.scanRoot, "Scan Plate", w, h, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 1.2})
    text(this.scanRoot, "Scan Text", t.scanPrompt, T_BODY, true, WHITE, w - 2, 2, new vec3(0, h / 2 - 2.2, 0.2), HorizontalAlignment.Center, false)
    this.scanButton = button(this.scanRoot, "ScanButton", t.scanButton, 13, BTN_H, new vec3(0, -h / 2 + 1 + BTN_H / 2, 0.6), () => this.onScanPinched())
  }

  /** Log chip on the desk's front-left corner; the list opens beside it. */
  private buildLog(): void {
    this.logChip = button(this.uiRoot, "LogChip", LABELS.log, BTN_W, BTN_H, new vec3(-42, 4, 25), () => this.toggleLog())
    this.facers.push(this.logChip.obj.getTransform())

    const h = 4.4 + LOG_LINES * LINE_CAPTION + 1
    this.logRoot = child(this.uiRoot, "CustodyLog", new vec3(-42, 9, 12))
    this.logRoot.createComponent("Component.Canvas")
    this.facers.push(this.logRoot.getTransform())
    panel(this.logRoot, "Log Plate", LOG_W, h, new vec3(0, h / 2, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 1.2})
    this.logTitle = text(this.logRoot, "Log Title", LABELS.logTitle, T_BODY, true, WHITE, LOG_W - 2, 1.8, new vec3(0, h - 1.9, 0.2), HorizontalAlignment.Left, false)
    panel(this.logRoot, "Log Rule", LOG_W - 2, 0.08, new vec3(0, h - 3.3, 0.2), {fill: PLATE_EDGE, radius: 0.04})
    const bodyH = LOG_LINES * LINE_CAPTION
    this.logBody = text(this.logRoot, "Log Entries", "", T_CAPTION, false, SOFT, LOG_W - 2, bodyH, new vec3(0, h - 3.9 - bodyH / 2, 0.2), HorizontalAlignment.Left, false)
    this.logBody.verticalAlignment = VerticalAlignment.Top
    this.logRoot.enabled = false
  }

  /** Scenario toggle: on the desk, front-right corner. Shows the current scenario; a pinch switches it. */
  private buildScenarioToggle(): void {
    const w = 18
    const h = 9
    const root = child(this.uiRoot, "ScenarioPanel", new vec3(43, 6.5, 24))
    root.createComponent("Component.Canvas")
    this.facers.push(root.getTransform())
    panel(root, "Scenario Plate", w, h, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 1.2})
    text(root, "Scenario Caption", LABELS.scenario, T_CAPTION, true, DIM, w - 2, 1.6, new vec3(0, h / 2 - 1.6, 0.2), HorizontalAlignment.Left, false)
    this.scenarioToggle = button(root, "ScenarioToggle", "", w - 2, BTN_H, new vec3(0, -h / 2 + 0.9 + BTN_H / 2, 0.6), () => this.onScenarioPinched())
  }

  /** "Scene secured" banner: green, over the desk. */
  private buildBanner(): void {
    const w = 46
    const h = 9.6
    this.bannerRoot = child(this.uiRoot, "SceneSecuredBanner", new vec3(0, 41, -12))
    this.bannerRoot.createComponent("Component.Canvas")
    this.facers.push(this.bannerRoot.getTransform())
    panel(this.bannerRoot, "Banner Plate", w, h, new vec3(0, 0, 0), {gradient: [GREEN_A, GREEN_B], border: GREEN_BORDER, borderSize: 0.22, radius: 1.2})
    text(this.bannerRoot, "Banner Title", VOLATILE_RULES.text.sceneSecured.toUpperCase(), T_LARGE, true, WHITE, w - 2, 3, new vec3(0, 1.7, 0.2), HorizontalAlignment.Center, false)
    this.bannerSub = text(this.bannerRoot, "Banner Time", "", T_BODY, false, GREEN, w - 2, 2, new vec3(0, -2.3, 0.2), HorizontalAlignment.Center, false)
    this.bannerRoot.enabled = false
  }

  // ───────────────────────────── Stand-ins ─────────────────────────────

  /** Dim the stand-in shapes and give them flat screens. Runtime only; nothing on disk changes. */
  private dressScene(): void {
    this.dimStandIns(this.sceneObject)
    const lap = this.screenFrame(this.laptop, "Laptop Screen (on)")
    if (lap) {
      const f = lap.frame
      // A dim desktop: wallpaper, a window, icons and a taskbar. Flat shapes only.
      panel(f, "Wallpaper", lap.w, lap.h, new vec3(0, 0, 0), {gradient: [new vec4(0.1, 0.18, 0.32, 1), new vec4(0.16, 0.3, 0.45, 1)], radius: 0.3})
      panel(f, "Window", lap.w * 0.46, lap.h * 0.5, new vec3(lap.w * 0.14, lap.h * 0.08, 0.05), {fill: new vec4(0.22, 0.28, 0.36, 1), border: new vec4(0.4, 0.48, 0.58, 1), borderSize: 0.08, radius: 0.4})
      panel(f, "Window Bar", lap.w * 0.46, lap.h * 0.07, new vec3(lap.w * 0.14, lap.h * 0.08 + lap.h * 0.215, 0.1), {fill: new vec4(0.34, 0.41, 0.5, 1), radius: 0.3})
      for (let i = 0; i < 4; i++) {
        panel(f, "Icon " + i, 1.5, 1.5, new vec3(-lap.w / 2 + 2, lap.h / 2 - 2.2 - i * 2.6, 0.05), {fill: new vec4(0.34, 0.45, 0.58, 1), radius: 0.35})
      }
      this.laptopFace = f
      panel(f, "Taskbar", lap.w, lap.h * 0.085, new vec3(0, -lap.h / 2 + lap.h * 0.0425, 0.05), {fill: new vec4(0.2, 0.25, 0.32, 1), radius: 0.2})
    }
    const ph = this.screenFrame(this.phone, "Phone Screen (on)")
    if (ph) {
      const f = ph.frame
      panel(f, "Lock Wallpaper", ph.w, ph.h, new vec3(0, 0, 0), {gradient: [new vec4(0.12, 0.14, 0.26, 1), new vec4(0.22, 0.18, 0.34, 1)], radius: 0.6})
      text(f, "Lock Time", "14:32", T_LARGE, true, new vec4(0.92, 0.94, 0.97, 1), ph.w, 2.2, new vec3(0, ph.h * 0.2, 0.1), HorizontalAlignment.Center, false)
      this.phoneFace = f
      this.phoneLockHint = text(f, "Lock Hint", "Locked", T_CAPTION, false, new vec4(0.7, 0.73, 0.78, 1), ph.w, 1.6, new vec3(0, ph.h * 0.2 - 2, 0.1), HorizontalAlignment.Center, false).getSceneObject()
    }
    this.routerLights = this.findIn(this.router, "Router Status Lights")
  }

  /** The stand-ins' flat screens and lights show the state the responder has confirmed. */
  private redrawStandIns(): void {
    const state = (id: DeviceId) => this.engine.getDevice(id).stateId
    if (this.laptopFace) this.laptopFace.enabled = state("LAP-01") !== "laptop.off"
    if (this.phoneFace) this.phoneFace.enabled = state("PH-01") !== "phone.off"
    if (this.phoneLockHint) this.phoneLockHint.enabled = state("PH-01") === null || state("PH-01") === "phone.on.locked"
    if (this.routerLights) this.routerLights.enabled = state("NET-01") !== "router.off"
  }

  private dimStandIns(obj: SceneObject): void {
    const n = obj.name
    const isPart = n.indexOf("Laptop ") === 0 || n.indexOf("Phone ") === 0 || n.indexOf("USB ") === 0 || n.indexOf("Router ") === 0 || n.indexOf("Desk ") === 0
    if (isPart) {
      const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (rmv && rmv.mainMaterial) {
        const m = rmv.mainMaterial.clone()
        const c = m.mainPass.baseColor as vec4
        if (n.indexOf("Lights") >= 0) {
          // Blue-white, not green, so the lights are not read as "done".
          m.mainPass.baseColor = new vec4(0.55, 0.66, 0.8, 1)
        } else if (n.indexOf("Screen") >= 0) {
          m.mainPass.baseColor = new vec4(0.1, 0.14, 0.22, c.a)
        } else {
          const f = n.indexOf("Desk ") === 0 ? 0.55 : n.indexOf("USB ") === 0 ? 0.75 : 0.62
          m.mainPass.baseColor = new vec4(c.r * f, c.g * f, c.b * f, c.a)
        }
        rmv.mainMaterial = m
      }
    }
    for (let i = 0; i < obj.getChildrenCount(); i++) this.dimStandIns(obj.getChild(i))
  }

  /**
   * An unscaled frame sitting on the face of a (scaled box) screen, +Z out of the screen
   * toward the viewer. Returns the frame and the face's width and height in cm.
   */
  private screenFrame(root: SceneObject, screenName: string): {frame: SceneObject; w: number; h: number} | null {
    const screen = this.findIn(root, screenName)
    if (!screen) return null
    const t = screen.getTransform()
    const rot = t.getWorldRotation()
    const sc = t.getWorldScale()
    const pos = t.getWorldPosition()
    const axes = [rot.multiplyVec3(vec3.right()), rot.multiplyVec3(vec3.up()), rot.multiplyVec3(vec3.forward())]
    const lens = [Math.abs(sc.x), Math.abs(sc.y), Math.abs(sc.z)]
    let ni = 0
    for (let i = 1; i < 3; i++) if (lens[i] < lens[ni]) ni = i
    let normal = axes[ni]
    const toCam = this.camTransform.getWorldPosition().sub(pos)
    if (normal.dot(toCam) < 0) normal = normal.uniformScale(-1)
    // "Up" on the face: world up for an upright screen, away from the viewer for one lying flat.
    const flat = Math.abs(normal.dot(vec3.up())) > 0.8
    let up = flat ? new vec3(0, 0, -1) : vec3.up()
    up = up.sub(normal.uniformScale(up.dot(normal))).normalize()
    const right = up.cross(normal).normalize()
    const others = [0, 1, 2].filter((i) => i !== ni)
    const aIsWidth = Math.abs(axes[others[0]].dot(right)) > Math.abs(axes[others[1]].dot(right))
    const w = aIsWidth ? lens[others[0]] : lens[others[1]]
    const h = aIsWidth ? lens[others[1]] : lens[others[0]]

    const frame = global.scene.createSceneObject(screenName + " face")
    frame.setParent(root)
    const ft = frame.getTransform()
    ft.setWorldScale(ONE)
    ft.setWorldRotation(basis(up, normal))
    ft.setWorldPosition(pos.add(normal.uniformScale(lens[ni] / 2 + 0.08)))
    frame.createComponent("Component.Canvas")
    return {frame, w, h}
  }

  private findIn(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) return obj
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const hit = this.findIn(obj.getChild(i), name)
      if (hit) return hit
    }
    return null
  }

  // ───────────────────────────── Per-frame ─────────────────────────────

  private onUpdate(): void {
    if (this.devices.length === 0) return
    if (!this.ready) {
      this.finishInitWhenReady()
      return
    }
    const dt = getDeltaTime()
    this.updateFacing()

    const target = this.simulatedGazeActive ? this.simulatedGaze : this.computeGazeTarget()

    // Collapse only after looking clearly away for a while; progress is kept.
    const open = this.openDev
    if (open) {
      if (target === open) {
        this.awayTimer = 0
      } else {
        this.awayTimer += dt
        if (this.awayTimer >= this.collapseSeconds) this.closeCard(open)
      }
    }

    // Dwell on a device whose card is closed: trace the ring, then open the card.
    if (target && target !== this.openDev) {
      if (this.dwellDev !== target) {
        this.dwellDev = target
        this.dwellTimer = 0
        this.placeRing(target)
      }
      this.dwellTimer += dt
      this.setRingProgress(Math.min(1, this.dwellTimer / this.dwellSeconds))
      this.faceRingToCamera()
      if (this.dwellTimer >= this.dwellSeconds) {
        target.ringTraced = true
        this.clearDwell()
        this.openCard(target)
      }
    } else if (this.dwellDev) {
      this.clearDwell()
    }

    this.updateClocks()
    this.updateCovered()
    this.updateMotion(dt)
    this.updateArrow()
  }

  private finishInitWhenReady(): void {
    this.initFrames++
    if (this.initFrames < 3) return
    const buttons: UiButton[] = [this.scanButton, this.logChip, this.scenarioToggle]
    for (const d of this.devices) buttons.push(d.answerA, d.answerB, d.reassess)
    let allReady = true
    for (const b of buttons) if (!buttonReady(b)) allReady = false
    if (!allReady && this.initFrames < 120) return

    for (const d of this.devices) {
      d.cardRoot.getTransform().setLocalScale(ONE)
      d.cardRoot.enabled = false
    }
    this.ready = true
    print("[Volatile] ready: " + this.devices.length + " devices, all chips grey, no cards open")
    if (this.debugSteps) this.runDebugSteps(this.debugSteps.split(";").map((s) => s.trim()).filter((s) => s.length > 0))
  }

  /**
   * Developer aid: replay a list of actions, one every few frames, to reach a state for a capture.
   * "scan", "look <id>" (sets the simulated gaze and waits for the card), "away", "a" or "b"
   * (answer on the open card), "reassess", "scenario", "log", "real" (give gaze back to the camera).
   */
  private runDebugSteps(steps: string[]): void {
    if (steps.length === 0) return
    const step = steps[0]
    let wait = 0.2
    if (step === "scan") this.onScanPinched()
    else if (step === "log") this.toggleLog()
    else if (step === "scenario") this.onScenarioPinched()
    else if (step === "reassess" && this.openDev) this.onReassess(this.openDev)
    else if (step === "real") this.setSimulatedGaze(null)
    else if (step === "away") {
      this.setSimulatedGaze("away")
      wait = this.collapseSeconds + 0.3
    } else if (step.indexOf("look ") === 0) {
      this.setSimulatedGaze(step.substring(5))
      wait = this.dwellSeconds + 0.3
    } else if ((step === "a" || step === "b") && this.openDev) this.onAnswer(this.openDev, step === "a" ? 0 : 1)
    else print("[Volatile] debug step skipped: " + step)
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => this.runDebugSteps(steps.slice(1)))
    ev.reset(wait)
  }

  /** Tags, cards and desk panels turn fully toward the responder (yaw and pitch). */
  private updateFacing(): void {
    const cam = this.camTransform.getWorldPosition()
    const up = viewUp(this.camTransform.getWorldRotation())
    for (const t of this.facers) faceCamera(t, cam, up)
  }

  /** The seizure clock counts up in the pill and on the card. */
  private updateClocks(): void {
    for (const d of this.devices) {
      const dv = this.engine.getDevice(d.id)
      const s = dv.clockSeconds === null ? -1 : dv.clockSeconds
      if (s === d.lastClock) continue
      d.lastClock = s
      if (s < 0) continue
      const line = dv.clockLabel + " " + hms(s)
      d.pillClock.text = line
      d.clock.text = line
    }
  }

  /**
   * Motion: one curve, one duration. A card grows out of its marker, a marker pops when its rank
   * changes, and a problem answer makes the step pulse forward once. Nothing loops.
   */
  private updateMotion(dt: number): void {
    for (const d of this.devices) {
      if (d.openAnim < 1) {
        d.openAnim = Math.min(1, d.openAnim + dt / MOTION_S)
        this.poseCard(d)
      }
      if (d.popAnim < 1) {
        d.popAnim = Math.min(1, d.popAnim + dt / MOTION_S)
        const s = 1 + 0.22 * (1 - this.easeOut(d.popAnim))
        d.markerRoot.getTransform().setLocalScale(new vec3(s, s, s))
      }
      if (d.pulseAnim < 1) {
        d.pulseAnim = Math.min(1, d.pulseAnim + dt / (MOTION_S * 2))
        const forward = 1.6 * Math.sin(Math.PI * d.pulseAnim)
        d.activeGroup.getTransform().setLocalPosition(new vec3(0, d.groupY, forward))
      }
    }
  }

  private easeOut(t: number): number {
    const u = 1 - t
    return 1 - u * u * u
  }

  /** Place the card for its open animation: from its marker, at 30% size, to its own spot. */
  private poseCard(d: DeviceUI): void {
    const e = this.easeOut(d.openAnim)
    const to = d.origin.add(d.layout.cardBottom)
    const from = this.uiRoot.getTransform().getInvertedWorldTransform().multiplyPoint(d.markerRoot.getTransform().getWorldPosition())
    const s = 0.3 + 0.7 * e
    const t = d.cardRoot.getTransform()
    t.setLocalPosition(vec3.lerp(from, to, e))
    t.setLocalScale(new vec3(s, s, s))
  }

  /** The best-ranked assessed device that still has steps to do. */
  private nextUnfinished(): DeviceUI | null {
    for (const r of this.engine.getRanking()) {
      if (this.engine.getDevice(r.deviceId).chip !== "done") return this.find(r.deviceId)
    }
    return null
  }

  /** A small arrow on the device just finished points at the next one when that is out of view. */
  private updateArrow(): void {
    const d = this.lastFinished
    for (const other of this.devices) if (other !== d) other.arrowRoot.enabled = false
    if (!d) return
    const next = this.engine.isSceneSecured() ? null : this.nextUnfinished()
    if (!next || next === d) {
      d.arrowRoot.enabled = false
      return
    }
    const camPos = this.camTransform.getWorldPosition()
    const camDir = this.camTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const nextPos = this.gazeCenter(next)
    const cos = Math.max(-1, Math.min(1, nextPos.sub(camPos).normalize().dot(camDir)))
    const outOfView = Math.acos(cos) > (OUT_OF_VIEW_DEG * Math.PI) / 180
    d.arrowRoot.enabled = outOfView
    if (!outOfView) return
    const local = d.tagRoot.getTransform().getInvertedWorldTransform().multiplyPoint(nextPos)
    const o = d.arrowRoot.getTransform().getLocalPosition()
    d.arrowRoot.getTransform().setLocalRotation(quat.angleAxis(Math.atan2(local.y - o.y, local.x - o.x), vec3.forward()))
  }

  /** While a card is open, hide any neighbour's tag it would cover. */
  private updateCovered(): void {
    const open = this.openDev
    if (!open) {
      for (const d of this.devices) d.tagRoot.enabled = true
      return
    }
    const cam = this.camTransform.getWorldPosition()
    const ct = open.cardRoot.getTransform()
    const p = ct.getWorldPosition()
    const rot = ct.getWorldRotation()
    const right = rot.multiplyVec3(vec3.right())
    const up = rot.multiplyVec3(vec3.up())
    const normal = rot.multiplyVec3(vec3.forward())
    for (const d of this.devices) {
      if (d === open) {
        d.tagRoot.enabled = true
        continue
      }
      // Test the tag's centre and both ends: a card may cover only one end of a wide tag.
      const tt = d.tagRoot.getTransform()
      const centre = tt.getWorldPosition()
      const half = tt.getWorldRotation().multiplyVec3(vec3.right()).uniformScale(d.layout.tagWidth / 2)
      let covered = false
      for (const point of [centre, centre.add(half), centre.sub(half)]) {
        const dir = point.sub(cam)
        const denom = dir.dot(normal)
        if (Math.abs(denom) < 0.0001) continue
        const k = p.sub(cam).dot(normal) / denom
        // In front of the card or behind it: either way the two would overlap in view.
        if (k <= 0) continue
        const hit = cam.add(dir.uniformScale(k)).sub(p)
        const x = hit.dot(right)
        const y = hit.dot(up)
        const my = 3.5 * k + 0.5
        if (Math.abs(x) < CARD_W / 2 + 0.3 && y > -my && y < open.cardHeight + my) covered = true
      }
      d.tagRoot.enabled = !covered
    }
  }

  // ───────────────────────────── Gaze ─────────────────────────────

  /** The device the responder is looking at, or null. Stands in for object recognition. */
  private computeGazeTarget(): DeviceUI | null {
    const camPos = this.camTransform.getWorldPosition()
    const camDir = this.camTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const margin = (this.gazeMarginDeg * Math.PI) / 180

    // An open card wins: while the gaze ray lands on it, a device behind it cannot take over.
    const open = this.openDev
    if (open) {
      const ct = open.cardRoot.getTransform()
      const p = ct.getWorldPosition()
      const rot = ct.getWorldRotation()
      const normal = rot.multiplyVec3(vec3.forward())
      const denom = camDir.dot(normal)
      if (Math.abs(denom) > 0.0001) {
        const k = p.sub(camPos).dot(normal) / denom
        if (k > 0) {
          const hit = camPos.add(camDir.uniformScale(k)).sub(p)
          const x = hit.dot(rot.multiplyVec3(vec3.right()))
          const y = hit.dot(rot.multiplyVec3(vec3.up()))
          if (Math.abs(x) < CARD_W / 2 + 2 && y > -2 && y < open.cardHeight + 2) return open
        }
      }
    }

    let best: DeviceUI | null = null
    let bestScore = 1
    for (const dev of this.devices) {
      const isOpen = dev === this.openDev
      const spheres: {c: vec3; r: number}[] = [{c: this.gazeCenter(dev), r: dev.layout.gazeRadius}]
      if (isOpen) {
        // The device, its tag, its card and its buttons count as one gaze target.
        const ct = dev.cardRoot.getTransform()
        const mid = ct.getWorldPosition().add(ct.getWorldRotation().multiplyVec3(vec3.up()).uniformScale(dev.cardHeight / 2))
        spheres.push({c: mid, r: Math.max(CARD_W, dev.cardHeight) / 2 + 3})
        spheres.push({c: dev.tagRoot.getTransform().getWorldPosition(), r: dev.layout.tagWidth / 2 + 2})
      }
      for (const s of spheres) {
        const v = s.c.sub(camPos)
        const dist = v.length
        if (dist < 1) continue
        if (!isOpen && dist > this.scanRangeCm) continue
        const cos = Math.max(-1, Math.min(1, v.uniformScale(1 / dist).dot(camDir)))
        const score = Math.acos(cos) / (Math.atan(s.r / dist) + margin)
        if (score < bestScore) {
          bestScore = score
          best = dev
        }
      }
    }
    return best
  }

  private gazeCenter(dev: DeviceUI): vec3 {
    return this.sceneObject.getTransform().getWorldTransform().multiplyPoint(dev.origin.add(dev.layout.gazeCenter))
  }

  // ───────────────────────────── Scan ring ─────────────────────────────

  private placeRing(dev: DeviceUI): void {
    const r = dev.layout.gazeRadius
    const segLen = ((2 * Math.PI * r) / RING_SEGMENTS) * 0.8
    for (let i = 0; i < RING_SEGMENTS; i++) {
      // Start at the top and trace clockwise as seen by the responder.
      const a = Math.PI / 2 - (i / RING_SEGMENTS) * 2 * Math.PI
      const t = this.ringSegments[i].getTransform()
      t.setLocalPosition(new vec3(Math.cos(a) * r, Math.sin(a) * r, 0))
      t.setLocalRotation(quat.angleAxis(a + Math.PI / 2, vec3.forward()))
      t.setLocalScale(new vec3(segLen, 0.35, 0.15))
    }
    this.ringRoot.getTransform().setWorldPosition(this.gazeCenter(dev))
    this.ringRoot.enabled = true
  }

  private faceRingToCamera(): void {
    faceCamera(this.ringRoot.getTransform(), this.camTransform.getWorldPosition(), viewUp(this.camTransform.getWorldRotation()))
  }

  private setRingProgress(p: number): void {
    this.ringProgress = p
    const lit = Math.ceil(p * RING_SEGMENTS)
    for (let i = 0; i < RING_SEGMENTS; i++) this.ringSegments[i].enabled = i < lit
  }

  private clearDwell(): void {
    this.dwellDev = null
    this.dwellTimer = 0
    this.setRingProgress(0)
    this.ringRoot.enabled = false
  }

  // ───────────────────────────── Open / close ─────────────────────────────

  private openCard(dev: DeviceUI): void {
    if (this.openDev && this.openDev !== dev) this.closeCard(this.openDev)
    this.openDev = dev
    this.awayTimer = 0
    dev.cardRoot.enabled = true
    this.redrawDevice(dev)
    dev.openAnim = 0
    this.poseCard(dev)
    const dv = this.engine.getDevice(dev.id)
    print("[Volatile] opened " + dev.id + (dv.question ? ", question: " + dv.question.stem : ", active step " + (dv.activeStep + 1)))
  }

  private closeCard(dev: DeviceUI): void {
    dev.cardRoot.enabled = false
    dev.openAnim = 1
    this.poseCard(dev)
    if (this.openDev === dev) this.openDev = null
    this.awayTimer = 0
    this.redrawDevice(dev)
    print("[Volatile] closed " + dev.id + " (progress kept)")
  }

  // ───────────────────────────── Pinches ─────────────────────────────

  /** The only path that answers a question or a fact. */
  private onAnswer(dev: DeviceUI, answer: AnswerIndex): void {
    if (!this.ready || this.openDev !== dev) return
    const dv = this.engine.getDevice(dev.id)
    const events = dv.question ? this.engine.answerQuestion(dev.id, answer) : this.engine.answerFact(dev.id, answer)
    this.apply(events)
  }

  private onReassess(dev: DeviceUI): void {
    if (!this.ready || this.openDev !== dev) return
    this.apply(this.engine.beginReassess(dev.id))
  }

  private onScenarioPinched(): void {
    if (!this.ready) return
    this.apply(this.engine.setScenario(this.engine.getScenario() === "criminal" ? "ransomware" : "criminal"))
  }

  private onScanPinched(): void {
    if (!this.ready) return
    this.apply(this.engine.confirmScan())
  }

  private toggleLog(): void {
    if (!this.ready) return
    this.logOpen = !this.logOpen
    this.logRoot.enabled = this.logOpen
    this.play(this.clickAudio, 0)
    print("[Volatile] custody log " + (this.logOpen ? "opened" : "closed") + " with " + this.engine.getLog().length + " entries")
  }

  /** React to what the engine reports, then redraw everything from its views. */
  private apply(events: EngineEvent[]): void {
    if (events.length === 0) return
    this.play(this.clickAudio, 0)
    let chimes = 0
    for (const e of events) {
      if (e.type === "logged") print("[Volatile] custody: " + e.entry.line)
      else if (e.type === "problem") {
        this.play(this.problemAudio, 0.12)
        this.find(e.deviceId).pulseAnim = 0
      } else if (e.type === "device_done") {
        print("[Volatile] device finished: " + e.deviceId)
        this.lastFinished = this.find(e.deviceId)
        this.play(this.chimeAudio, 0.25 + chimes * 1.0)
        chimes++
      } else if (e.type === "scene_secured") {
        this.play(this.chimeAudio, 0.25 + chimes * 1.0)
        chimes++
        this.showBanner()
      } else if (e.type === "ranks_changed") {
        print("[Volatile] ranks: " + this.engine.getRanking().map((r) => "#" + r.rank + " " + r.deviceId).join(", "))
      }
    }
    this.redrawAll()
  }

  private showBanner(): void {
    const time = ms(this.engine.getElapsedSeconds())
    this.bannerText = VOLATILE_RULES.text.sceneSecured + ", " + LABELS.totalTime.toLowerCase() + " " + time
    this.bannerSub.text = LABELS.totalTime + " " + time
    this.bannerRoot.enabled = true
    print("[Volatile] " + this.bannerText)
  }

  private play(audio: AudioComponent, delay: number): void {
    if (!audio || !audio.audioTrack) return
    if (delay <= 0) {
      audio.play(1)
      return
    }
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => audio.play(1))
    ev.reset(delay)
  }

  // ───────────────────────────── Redraw ─────────────────────────────

  private redrawAll(): void {
    for (const d of this.devices) this.redrawDevice(d)
    this.scanRoot.enabled = !this.engine.isScanConfirmed()
    this.scenarioToggle.label.text = VOLATILE_RULES.text.scenarioLabels[this.engine.getScenario()]
    if (this.lastFinished && this.engine.getDevice(this.lastFinished.id).chip !== "done") this.lastFinished = null
    if (this.dressStandIns) this.redrawStandIns()
    this.redrawLog()
  }

  private redrawDevice(dev: DeviceUI): void {
    const dv = this.engine.getDevice(dev.id)
    dev.lastClock = -1
    this.redrawTag(dev, dv)
    if (dev === this.openDev) this.redrawCard(dev, dv)
  }

  private chipColor(chip: ChipStatus): vec4 {
    return chip === "done" ? GREEN_BORDER : chip === "in_progress" ? AMBER : chip === "assessed" ? ASSESSED_BORDER : GREY_BORDER
  }

  private redrawTag(dev: DeviceUI, dv: DeviceView): void {
    // Text can only be measured while it is enabled, so show the tag while it is redrawn.
    const wasEnabled = dev.tagRoot.enabled
    dev.tagRoot.enabled = true

    const open = dev === this.openDev
    const color = this.chipColor(dv.chip)
    dev.markerPlate.borderColor = color
    dev.markerFoot.backgroundColor = color
    dev.markerNumeral.text = dv.rank === null ? "?" : "" + dv.rank
    // A marker pops when its rank changes.
    if (this.ready && dv.rank !== dev.lastRank) dev.popAnim = 0
    dev.lastRank = dv.rank
    const done = dv.chip === "done"
    dev.markerFoot.getSceneObject().enabled = !done
    dev.markerCheck.getSceneObject().enabled = done

    const restW = dev.layout.tagWidth - MARKER - TAG_GAP

    // Reason pill: beside the marker while the card is closed.
    const showPill = !open && dv.stateId !== null
    dev.pillRoot.enabled = showPill
    if (showPill) {
      const w = restW - 1.6
      const hasClock = dv.clockSeconds !== null
      dev.pillClock.getSceneObject().enabled = hasClock
      const reasonH = setWrapped(dev.pillReason, dv.reason, w)
      const clockH = hasClock ? LINE_CAPTION : 0
      const blockH = reasonH + (hasClock ? 0.45 : 0) + clockH
      placePanel(dev.pillPlate, restW, Math.max(MARKER, blockH + 1.6), new vec3(0, 0, 0))
      placeText(dev.pillReason, w, reasonH, new vec3(0, blockH / 2 - reasonH / 2, 0.1))
      if (hasClock) {
        dev.pillClock.text = dv.clockLabel + " " + hms(dv.clockSeconds)
        placeText(dev.pillClock, w, clockH, new vec3(0, -blockH / 2 + clockH / 2, 0.1))
      }
    }

    // "Never do" strip: on the device while its card is open.
    const showStrip = open && dv.strip !== null
    dev.stripRoot.enabled = showStrip
    if (showStrip) {
      const textW = restW - 5
      const headH = setWrapped(dev.stripHeadline, dv.strip.text, textW)
      const blockH = headH + 0.45 + LINE_CAPTION
      placePanel(dev.stripPlate, restW, Math.max(MARKER, blockH + 1.7), new vec3(0, 0, 0))
      placeText(dev.stripHeadline, textW, headH, new vec3(1.9, blockH / 2 - headH / 2, 0.1))
      setLine(dev.stripSource, dv.strip.sources.join(SOURCE_JOIN))
      placeText(dev.stripSource, textW, LINE_CAPTION, new vec3(1.9, -blockH / 2 + LINE_CAPTION / 2, 0.1))
      const badgeY = blockH / 2 - LINE_BODY / 2
      dev.stripBadge.getSceneObject().getTransform().setLocalPosition(new vec3(-restW / 2 + 2.3, badgeY, 0.1))
      dev.stripMark.getSceneObject().getTransform().setLocalPosition(new vec3(-restW / 2 + 2.3, badgeY, 0.2))
    }

    dev.tagRoot.enabled = wasEnabled
  }

  private redrawCard(dev: DeviceUI, dv: DeviceView): void {
    const asking = dv.question !== null
    const showSteps = !asking
    const hasClock = showSteps && dv.clockSeconds !== null
    let active: StepView | null = null
    if (showSteps && dv.activeStep >= 0) active = dv.steps[dv.activeStep]
    const showActive = active !== null && active.fact !== null
    const contested = showActive && active.contested !== null && active.contested.length > 0
    const showNudge = showSteps && dv.nudge !== null && dv.nudge.length > 0

    // Show and hide first: text can only be measured while it is enabled.
    dev.questionStem.getSceneObject().enabled = asking
    dev.reason.getSceneObject().enabled = showSteps
    dev.clock.getSceneObject().enabled = hasClock
    dev.clockNote.getSceneObject().enabled = hasClock
    for (let i = 0; i < dev.rows.length; i++) {
      dev.rows[i].getSceneObject().enabled = showSteps && i < dv.steps.length && !(showActive && dv.steps[i] === active)
    }
    dev.activeGroup.enabled = asking || showActive
    dev.activeRow.getSceneObject().enabled = showActive
    dev.activeBar.getSceneObject().enabled = showActive
    dev.activeText.getSceneObject().enabled = showActive
    dev.sourceChip.getSceneObject().enabled = showActive
    dev.sourceText.getSceneObject().enabled = showActive
    dev.contestedChip.getSceneObject().enabled = contested
    dev.contestedText.getSceneObject().enabled = contested
    dev.contestedNote.getSceneObject().enabled = contested
    dev.factStem.getSceneObject().enabled = showActive
    dev.footerRule.getSceneObject().enabled = showSteps
    dev.custody.getSceneObject().enabled = showSteps
    dev.nudge.getSceneObject().enabled = showNudge
    dev.reassess.obj.enabled = showSteps

    let y = -PAD

    // Label-style header: device ID and state.
    placeText(dev.headerId, INNER_W, 1.6, new vec3(0, y - 0.8, 0.2))
    dev.headerState.text = asking ? (dv.stateId === null ? LABELS.notAssessed : LABELS.reassessing) : dv.stateLabel
    placeText(dev.headerState, INNER_W, 1.6, new vec3(0, y - 0.8, 0.2))
    y -= 2
    dev.headerRule.getSceneObject().getTransform().setLocalPosition(new vec3(0, y, 0.2))
    y -= 0.6

    if (asking) {
      // One state question at a time, two buttons.
      const h = setWrapped(dev.questionStem, dv.question.stem, INNER_W)
      placeText(dev.questionStem, INNER_W, h, new vec3(0, y - h / 2, 0.2))
      y -= h + 0.7
      dev.groupY = y
      y += this.placeButtons(dev, dv.question.answers, 0)
    } else {
      // Rank and reason.
      const rh = setWrapped(dev.reason, "#" + dv.rank + "  " + dv.reason, INNER_W)
      placeText(dev.reason, INNER_W, rh, new vec3(0, y - rh / 2, 0.2))
      y -= rh + 0.4
      if (hasClock) {
        dev.clock.text = dv.clockLabel + " " + hms(dv.clockSeconds)
        placeText(dev.clock, INNER_W, LINE_CAPTION, new vec3(0, y - LINE_CAPTION / 2, 0.2))
        y -= LINE_CAPTION + 0.25
        const nh = setWrapped(dev.clockNote, dv.clockNote, INNER_W)
        placeText(dev.clockNote, INNER_W, nh, new vec3(0, y - nh / 2, 0.2))
        y -= nh + 0.4
      }
      y -= 0.3

      // Steps: done ones checked, the active one opened up, later ones locked.
      for (let i = 0; i < dv.steps.length && i < MAX_STEPS; i++) {
        const step = dv.steps[i]
        const label = step.number + ". " + step.text
        if (step === active && showActive) {
          y -= this.layoutActiveStep(dev, step, label, y) + 0.35
        } else {
          const row = dev.rows[i]
          const done = step.status === "done"
          row.textFill.color = done ? GREEN : DIM
          setFitted(row, (done ? CHECK + " " : "") + label, INNER_W)
          placeText(row, INNER_W, ROW_H, new vec3(0, y - ROW_H / 2, 0.2))
          y -= ROW_H
        }
      }

      // Footer: the latest custody line for this device, the nudge, and Reassess.
      y -= 0.25
      dev.footerRule.getSceneObject().getTransform().setLocalPosition(new vec3(0, y, 0.2))
      y -= 0.5
      const last = this.lastEntry(dev.id)
      const ch = setWrapped(dev.custody, last ? last.time + "   " + last.deviceId + "   " + last.text : "", INNER_W)
      placeText(dev.custody, INNER_W, ch, new vec3(0, y - ch / 2, 0.2))
      y -= ch + 0.45
      if (showNudge) {
        const nh = setWrapped(dev.nudge, dv.nudge, INNER_W)
        placeText(dev.nudge, INNER_W, nh, new vec3(0, y - nh / 2, 0.2))
        y -= nh + 0.45
      }
      dev.reassess.obj.getTransform().setLocalPosition(new vec3(-INNER_W / 2 + BTN_W / 2, y - REASSESS_H / 2, 0.6))
      y -= REASSESS_H + 0.1
    }
    dev.activeGroup.getTransform().setLocalPosition(new vec3(0, dev.groupY, 0))

    const h = -y + PAD * 0.8
    dev.cardHeight = h
    placePanel(dev.plate, CARD_W, h, new vec3(0, -h / 2, 0))
    dev.content.getTransform().setLocalPosition(new vec3(0, h, 0))
  }

  /**
   * Lay out the active step inside its group, whose top edge sits at `top` on the card:
   * a lighter row with a bar down its left edge, the step text, the source chip, the Contested
   * chip and note where standards disagree, the question and the two fact buttons.
   * Returns the height of the block.
   */
  private layoutActiveStep(dev: DeviceUI, step: StepView, label: string, top: number): number {
    dev.groupY = top
    const left = ACTIVE_X - ACTIVE_W / 2
    let y = -0.6
    dev.activeText.textFill.color = step.problemOpen ? AMBER : WHITE
    const h = setWrapped(dev.activeText, label, ACTIVE_W)
    placeText(dev.activeText, ACTIVE_W, h, new vec3(ACTIVE_X, y - h / 2, 0.3))
    y -= h + 0.55

    // Source chip: a small outlined pill. The Contested chip sits beside it when there is room.
    const chipW = Math.min(ACTIVE_W, setLine(dev.sourceText, step.sources.join(SOURCE_JOIN)) + 1.5)
    placePanel(dev.sourceChip, chipW, 1.7, new vec3(left + chipW / 2, y - 0.85, 0.3))
    placeText(dev.sourceText, chipW, 1.6, new vec3(left + chipW / 2, y - 0.85, 0.4))
    if (step.contested !== null && step.contested.length > 0) {
      const cw = setLine(dev.contestedText, LABELS.contested) + 1.5
      let cx = left + chipW + 0.5 + cw / 2
      if (chipW + 0.5 + cw > ACTIVE_W) {
        y -= 1.7 + 0.4
        cx = left + cw / 2
      }
      placePanel(dev.contestedChip, cw, 1.7, new vec3(cx, y - 0.85, 0.3))
      placeText(dev.contestedText, cw, 1.6, new vec3(cx, y - 0.85, 0.4))
      y -= 1.7 + 0.45
      const nh = setWrapped(dev.contestedNote, step.contested, ACTIVE_W)
      placeText(dev.contestedNote, ACTIVE_W, nh, new vec3(ACTIVE_X, y - nh / 2, 0.3))
      y -= nh + 0.6
    } else {
      y -= 1.7 + 0.6
    }

    dev.factStem.text = step.fact.stem
    placeText(dev.factStem, ACTIVE_W, LINE_CAPTION, new vec3(ACTIVE_X, y - LINE_CAPTION / 2, 0.3))
    y -= LINE_CAPTION + 0.5
    y += this.placeButtons(dev, step.fact.answers, y)

    const blockH = -y
    placePanel(dev.activeRow, CARD_W - 0.8, blockH, new vec3(0, -blockH / 2, 0.15))
    placePanel(dev.activeBar, 0.34, blockH - 1, new vec3(-CARD_W / 2 + 0.75, -blockH / 2, 0.25))
    dev.activeBar.backgroundColor = step.problemOpen ? AMBER : CYAN
    return blockH
  }

  /** Two answer buttons side by side with their top edge at `y` inside the group. Returns the (negative) height used. */
  private placeButtons(dev: DeviceUI, answers: [string, string], y: number): number {
    const bx = (BTN_W + 0.8) / 2
    dev.answerA.label.text = answers[0]
    dev.answerB.label.text = answers[1]
    dev.answerA.obj.getTransform().setLocalPosition(new vec3(ACTIVE_X - bx + 0.1, y - BTN_H / 2, 0.6))
    dev.answerB.obj.getTransform().setLocalPosition(new vec3(ACTIVE_X + bx - 0.1, y - BTN_H / 2, 0.6))
    return -(BTN_H + 0.6)
  }

  private lastEntry(id: DeviceId): LogEntry | null {
    const log = this.engine.getLog()
    for (let i = log.length - 1; i >= 0; i--) if (log[i].deviceId === id) return log[i]
    return null
  }

  private redrawLog(): void {
    const log = this.engine.getLog()
    this.logTitle.text = LABELS.logTitle + " (" + log.length + ")"
    if (log.length === 0) {
      this.logBody.text = LABELS.logEmpty
      return
    }
    // The newest entries, oldest of them first.
    const shown = log.slice(Math.max(0, log.length - LOG_LINES))
    this.logBody.text = shown.map((e) => (e.line.length > LOG_CHARS ? e.line.substring(0, LOG_CHARS - 1) + "…" : e.line)).join("\n")
  }

  // ───────────────────────────── Test API ─────────────────────────────
  // Tests pinch the real buttons by name ("AnswerA <id>", "AnswerB <id>", "Reassess <id>",
  // "ScanButton", "LogChip", "ScenarioToggle") and read state through these methods.

  private find(id: string): DeviceUI {
    for (const d of this.devices) if (d.id === id) return d
    throw new Error("Unknown device " + id)
  }

  isReady(): boolean {
    return this.ready
  }

  /**
   * Simulate where the responder is looking. LEAF cannot move the head, so tests use this in
   * place of head pose; the dwell timer, ring, open and close logic all still run.
   * Pass a device ID to look at it, "away" to look at nothing, or null to use the real camera.
   */
  setSimulatedGaze(target: string | null): void {
    if (target === null) {
      this.simulatedGazeActive = false
      this.simulatedGaze = null
      return
    }
    this.simulatedGazeActive = true
    this.simulatedGaze = target === "away" ? null : this.find(target)
  }

  getDeviceIds(): DeviceId[] {
    return this.engine.getDeviceIds()
  }

  /** The engine's view of a device: chip, question, state, rank, reason, strip, steps, clock. */
  getDevice(id: string): DeviceView {
    return this.engine.getDevice(id as DeviceId)
  }

  getRanking(): {deviceId: DeviceId; rank: number; reason: string}[] {
    return this.engine.getRanking()
  }

  getLog(): LogEntry[] {
    return this.engine.getLog().slice()
  }

  getScenario(): Scenario {
    return this.engine.getScenario()
  }

  isScanConfirmed(): boolean {
    return this.engine.isScanConfirmed()
  }

  isSceneSecured(): boolean {
    return this.engine.isSceneSecured()
  }

  /** ID of the device whose card is open, or null. */
  getOpenCardId(): string | null {
    return this.openDev ? this.openDev.id : null
  }

  isCardOpen(id: string): boolean {
    return this.openDev === this.find(id)
  }

  /** True once the scan ring has fully traced around this device at least once. */
  hasRingTraced(id: string): boolean {
    return this.find(id).ringTraced
  }

  getRingProgress(): number {
    return this.ringProgress
  }

  isScanPromptVisible(): boolean {
    return this.scanRoot.enabled
  }

  isLogOpen(): boolean {
    return this.logOpen
  }

  /** The label on the scenario toggle: the current scenario. */
  getScenarioToggleLabel(): string {
    return this.scenarioToggle.label.text
  }

  isBannerVisible(): boolean {
    return this.bannerRoot.enabled
  }

  /** "Scene secured, total time 04:12" once the banner shows; empty before. */
  getBannerText(): string {
    return this.bannerText
  }

  /** What is drawn for a device right now, read back from the scene objects. */
  getDrawn(id: string): {
    marker: string
    markerChecked: boolean
    pill: string | null
    pillClock: string | null
    strip: string | null
    stripSource: string | null
    cardHeader: string | null
    cardText: string[]
    sourceChip: string | null
    contested: string | null
    nudge: string | null
    reassess: boolean
    arrow: boolean
    factStem: string | null
    buttons: [string, string] | null
    custody: string | null
  } {
    const d = this.find(id)
    const open = d === this.openDev
    const on = (t: Text) => t.getSceneObject().enabled
    const pill = d.pillRoot.enabled
    const strip = d.stripRoot.enabled
    const buttons = open && d.activeGroup.enabled
    const dv = this.engine.getDevice(d.id)
    const steps = dv.steps.map((s, i) => (i === dv.activeStep && on(d.activeText) ? d.activeText.text : i < d.rows.length ? d.rows[i].text : ""))
    return {
      marker: d.markerNumeral.text,
      markerChecked: on(d.markerCheck),
      pill: pill ? d.pillReason.text : null,
      pillClock: pill && on(d.pillClock) ? d.pillClock.text : null,
      strip: strip ? d.stripHeadline.text : null,
      stripSource: strip ? d.stripSource.text : null,
      cardHeader: open ? d.headerId.text + " | " + d.headerState.text : null,
      cardText: open ? (on(d.questionStem) ? [d.questionStem.text] : steps) : [],
      sourceChip: open && on(d.sourceText) ? d.sourceText.text : null,
      contested: open && on(d.contestedNote) ? d.contestedNote.text : null,
      nudge: open && on(d.nudge) ? d.nudge.text : null,
      reassess: open && d.reassess.obj.enabled,
      arrow: d.arrowRoot.enabled,
      factStem: open && on(d.factStem) ? d.factStem.text : null,
      buttons: buttons ? [d.answerA.label.text, d.answerB.label.text] : null,
      custody: open && on(d.custody) ? d.custody.text : null
    }
  }
}
