import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {DEVICES, DeviceDef, STACK_WIDTH} from "./VolatileData"

/**
 * Volatile — order-of-volatility overlay for digital forensics first responders.
 *
 * Each stand-in device carries a small rank chip. Looking at a device for about a second
 * (gaze dwell stands in for object recognition) traces a scan ring, then expands the full
 * tag and the step stack. Pinching the Done button under the active step completes that
 * step only, and writes one timestamped custody entry.
 *
 * The scene object this script sits on has its origin at the centre of the desk top.
 */

export type ChipState = "untouched" | "in_progress" | "done"

export type CustodyEntry = {
  time: string
  deviceId: string
  deviceName: string
  action: string
  /** "14:32:07, Laptop (LAP-01), screen photographed." */
  line: string
}

type Plate = {obj: SceneObject; mat: Material}

type Row = {
  root: SceneObject
  text: Text
  highlight: SceneObject
  height: number
}

type DeviceUI = {
  def: DeviceDef
  root: SceneObject
  chipRoot: SceneObject
  chipPlate: Plate
  chipText: Text
  tagRoot: SceneObject
  stackRoot: SceneObject
  plateObj: SceneObject
  plate: BackPlate
  rows: Row[]
  doneObj: SceneObject
  doneButton: Button
  custodyObj: SceneObject
  custodyText: Text
  nextRoot: SceneObject
  nextText: Text
  arrowRoot: SceneObject
  stackHeight: number
  completed: number
  expanded: boolean
  ringTraced: boolean
}

// Colours. The display is additive (black is transparent), so everything stays light.
const WHITE = new vec4(1, 1, 1, 1)
const DIM = new vec4(1, 1, 1, 0.5)
const GREEN_TEXT = new vec4(0.5, 0.95, 0.62, 1)
const CUSTODY_TEXT = new vec4(0.72, 0.9, 1, 1)
const CHIP_GREY = new vec4(0.42, 0.44, 0.48, 1)
const CHIP_AMBER = new vec4(0.9, 0.55, 0.05, 1)
const CHIP_GREEN = new vec4(0.1, 0.62, 0.3, 1)
const ROW_HIGHLIGHT = new vec4(0.16, 0.34, 0.66, 1)
const RING_COLOR = new vec4(0.55, 0.95, 1, 1)
const BANNER_GREEN = new vec4(0.08, 0.6, 0.28, 1)

const CHECK = "✓"
const RING_SEGMENTS = 48
const DONE_W = 10
const DONE_H = 4.6
const TEXT_W = STACK_WIDTH - 3
const CHARS_PER_LINE = 40
const LOG_W = 38
const LOG_H = 22

@component
export class VolatileController extends BaseScriptComponent {
  @ui.label("Volatile — order of volatility overlay")
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
  @hint("Unit box mesh used for plates, chips and the scan ring.")
  boxMesh: RenderMesh

  @input
  @hint("Unlit material, cloned and tinted for each plate.")
  uiMaterial: Material
  @ui.group_end

  @ui.group_start("Gaze dwell (stands in for recognition)")
  @input
  @widget(new SliderWidget(0.3, 3, 0.1))
  @hint("Seconds of gaze on a device before it expands.")
  dwellSeconds: number = 1.0

  @input
  @widget(new SliderWidget(0.5, 4, 0.05))
  @hint("Seconds of looking clearly away before the tag and stack collapse.")
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

  @ui.group_start("Sound")
  @input
  @allowUndefined
  @hint("Soft click played when a step is completed.")
  clickSound: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Chime played when a device is finished and when the scene is secured.")
  chimeSound: AudioTrackAsset
  @ui.group_end

  private devices: DeviceUI[] = []
  private billboards: Transform[] = []
  private camTransform: Transform

  private ringRoot: SceneObject
  private ringSegments: SceneObject[] = []
  private ringProgress: number = 0

  private logChipButton: Button
  private logRoot: SceneObject
  private logTitle: Text
  private logBody: Text
  private logOpen: boolean = false

  private bannerRoot: SceneObject
  private bannerSub: Text
  private bannerText: string = ""

  private clickAudio: AudioComponent
  private chimeAudio: AudioComponent

  private custody: CustodyEntry[] = []
  private expandedDev: DeviceUI | null = null
  private dwellDev: DeviceUI | null = null
  private dwellTimer: number = 0
  private awayTimer: number = 0
  private secured: boolean = false
  private ready: boolean = false
  private initFrames: number = 0
  private startTime: number = 0

  // Simulated gaze, used by tests because LEAF cannot move the responder's head.
  private simulatedGazeActive: boolean = false
  private simulatedGaze: DeviceUI | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ───────────────────────────── Build ─────────────────────────────

  private build(): void {
    this.camTransform = this.cameraObject.getTransform()
    this.startTime = getTime()

    const standIns: SceneObject[] = [this.laptop, this.router, this.phone, this.usb]
    for (let i = 0; i < DEVICES.length; i++) {
      this.devices.push(this.buildDevice(DEVICES[i], standIns[i]))
    }
    this.buildRing()
    this.buildLog()
    this.buildBanner()

    this.clickAudio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    this.chimeAudio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    if (this.clickSound) this.clickAudio.audioTrack = this.clickSound
    if (this.chimeSound) this.chimeAudio.audioTrack = this.chimeSound
  }

  private child(parent: SceneObject, name: string, pos: vec3): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    o.getTransform().setLocalPosition(pos)
    return o
  }

  private makePlate(parent: SceneObject, name: string, w: number, h: number, color: vec4, pos: vec3): Plate {
    const obj = this.child(parent, name, pos)
    obj.getTransform().setLocalScale(new vec3(w, h, 0.15))
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.boxMesh
    const mat = this.uiMaterial.clone()
    mat.mainPass.baseColor = color
    rmv.clearMaterials()
    rmv.addMaterial(mat)
    return {obj, mat}
  }

  private makeText(
    parent: SceneObject,
    name: string,
    str: string,
    size: number,
    bold: boolean,
    color: vec4,
    w: number,
    h: number,
    pos: vec3,
    align: HorizontalAlignment,
    wrap: boolean
  ): Text {
    const o = this.child(parent, name, pos)
    const t = o.createComponent("Component.Text") as Text
    t.text = str
    t.size = size
    t.weight = bold ? 700 : 500
    t.textFill.color = color
    t.depthTest = true
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    return t
  }

  private makeButton(parent: SceneObject, name: string, label: string, pos: vec3, onPinch: () => void): Button {
    const o = this.child(parent, name, pos)
    const btn = o.createComponent(Button.getTypeName()) as Button
    const size = new vec3(DONE_W, DONE_H, 1)
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
    })
    this.makeText(o, name + " Label", label, 54, true, WHITE, DONE_W - 0.5, 2.6, new vec3(0, 0, 0.15), HorizontalAlignment.Center, false)
    // Element-level trigger event: one subscription, one code path per pinch.
    btn.onTriggerUp.add(onPinch)
    return btn
  }

  private buildDevice(def: DeviceDef, root: SceneObject): DeviceUI {
    // Rank chip: small, always visible from start, facing the user.
    const chipRoot = this.child(root, "RankChip " + def.id, def.chipOffset)
    const chipPlate = this.makePlate(chipRoot, "Chip Plate", 5, 2.7, CHIP_GREY, new vec3(0, 0, 0))
    const chipText = this.makeText(chipRoot, "Chip Text", "#" + def.rank, 48, true, WHITE, 5, 2.7, new vec3(0, 0, 0.3), HorizontalAlignment.Center, false)
    this.billboards.push(chipRoot.getTransform())

    // Full tag: snaps onto the top edge of the device.
    const tagRoot = this.child(root, "Tag " + def.id, def.tagOffset)
    this.makePlate(tagRoot, "Tag Plate", def.tagWidth, def.tagHeight, def.tagColor, new vec3(0, 0, 0))
    const headline = def.tagTwoLines ? def.headline.replace(": ", ":\n") : def.headline
    this.makeText(tagRoot, "Tag Text", headline, def.tagTwoLines ? 41 : 54, true, WHITE, def.tagWidth - 1, def.tagHeight, new vec3(0, 0, 0.3), HorizontalAlignment.Center, false)
    this.billboards.push(tagRoot.getTransform())

    // Step stack: beside the device, numbered steps top to bottom.
    const stackRoot = this.child(root, "StepStack " + def.id, def.stackOffset)
    // Canvas (hierarchy sort) so the see-through plate always draws before the rows on top of it.
    stackRoot.createComponent("Component.Canvas")
    this.billboards.push(stackRoot.getTransform())
    const plateObj = this.child(stackRoot, "Stack Plate", new vec3(0, 0, 0))
    const plate = plateObj.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"

    const rows: Row[] = []
    for (let i = 0; i < def.steps.length; i++) {
      const label = i + 1 + ". " + def.steps[i].label
      const lines = Math.ceil((label.length + 2) / CHARS_PER_LINE)
      const height = lines * 1.35 + 0.9
      const rowRoot = this.child(stackRoot, "Step " + (i + 1), new vec3(0, 0, 0.7))
      const highlight = this.makePlate(rowRoot, "Step Highlight", STACK_WIDTH - 1.2, height - 0.2, ROW_HIGHLIGHT, new vec3(0, 0, 0)).obj
      const text = this.makeText(rowRoot, "Step Text", label, 39, false, DIM, TEXT_W, height, new vec3(0, 0, 0.3), HorizontalAlignment.Left, true)
      rows.push({root: rowRoot, text, highlight, height})
    }

    const custodyText = this.makeText(stackRoot, "CustodyLine " + def.id, "", 34, false, CUSTODY_TEXT, TEXT_W, 4.2, new vec3(0, 0, 0.9), HorizontalAlignment.Left, true)

    // "Next device" line, with an arrow that only shows when the next device is out of view.
    const nextRoot = this.child(stackRoot, "NextDevice " + def.id, new vec3(0, 0, 0.9))
    const nextText = this.makeText(nextRoot, "Next Text", "", 36, true, WHITE, TEXT_W - 6, 2.4, new vec3(-3, 0, 0), HorizontalAlignment.Left, false)
    const arrowRoot = this.child(nextRoot, "NextArrow " + def.id, new vec3(STACK_WIDTH / 2 - 4, 0, 0.1))
    this.makePlate(arrowRoot, "Arrow Shaft", 4, 0.5, WHITE, new vec3(0, 0, 0))
    const headA = this.makePlate(arrowRoot, "Arrow Head A", 1.8, 0.5, WHITE, new vec3(1.4, 0.5, 0)).obj
    const headB = this.makePlate(arrowRoot, "Arrow Head B", 1.8, 0.5, WHITE, new vec3(1.4, -0.5, 0)).obj
    headA.getTransform().setLocalRotation(quat.angleAxis(-0.7, vec3.forward()))
    headB.getTransform().setLocalRotation(quat.angleAxis(0.7, vec3.forward()))

    const dev: DeviceUI = {
      def,
      root,
      chipRoot,
      chipPlate,
      chipText,
      tagRoot,
      stackRoot,
      plateObj,
      plate,
      rows,
      doneObj: null,
      doneButton: null,
      custodyObj: custodyText.getSceneObject(),
      custodyText,
      nextRoot,
      nextText,
      arrowRoot,
      stackHeight: 0,
      completed: 0,
      expanded: false,
      ringTraced: false
    }

    // One big Done button, pinned right under the active step.
    dev.doneButton = this.makeButton(stackRoot, "DoneButton " + def.id, "DONE", new vec3(0, 0, 0.9), () => this.onDonePinched(dev))
    dev.doneObj = dev.doneButton.getSceneObject()

    this.refreshDevice(dev)
    // Keep UI Kit elements enabled (but invisibly small) until they have initialised.
    tagRoot.enabled = false
    stackRoot.getTransform().setLocalScale(new vec3(0.001, 0.001, 0.001))
    return dev
  }

  private buildRing(): void {
    this.ringRoot = this.child(this.sceneObject, "ScanRing", new vec3(0, 0, 0))
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const seg = this.makePlate(this.ringRoot, "Ring Segment", 1, 0.35, RING_COLOR, new vec3(0, 0, 0)).obj
      seg.enabled = false
      this.ringSegments.push(seg)
    }
    this.ringRoot.enabled = false
  }

  private buildLog(): void {
    // Log chip: desk front-left corner, next to the laptop.
    this.logChipButton = this.makeButton(this.sceneObject, "LogChip", "Log", new vec3(-52, 3.6, 25), () => this.toggleLog())
    this.billboards.push(this.logChipButton.getSceneObject().getTransform())

    // Custody log list: on the desk next to the chip, facing the user.
    this.logRoot = this.child(this.sceneObject, "CustodyLog", new vec3(-34, 29, 4))
    this.logRoot.createComponent("Component.Canvas")
    this.billboards.push(this.logRoot.getTransform())
    const plateObj = this.child(this.logRoot, "Log Plate", new vec3(0, -LOG_H / 2, 0))
    const plate = plateObj.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    plate.size = new vec2(LOG_W, LOG_H)
    this.logTitle = this.makeText(this.logRoot, "Log Title", "CUSTODY LOG", 44, true, WHITE, LOG_W - 3, 2.6, new vec3(0, -2.2, 0.8), HorizontalAlignment.Left, false)
    this.logBody = this.makeText(this.logRoot, "Log Entries", "", 34, false, CUSTODY_TEXT, LOG_W - 3, LOG_H - 5, new vec3(0, -4 - (LOG_H - 5) / 2, 0.8), HorizontalAlignment.Left, true)
    this.logBody.verticalAlignment = VerticalAlignment.Top
    this.refreshLog()
    this.logRoot.getTransform().setLocalScale(new vec3(0.001, 0.001, 0.001))
  }

  private buildBanner(): void {
    this.bannerRoot = this.child(this.sceneObject, "SceneSecuredBanner", new vec3(0, 50, -6))
    this.billboards.push(this.bannerRoot.getTransform())
    this.makePlate(this.bannerRoot, "Banner Plate", 58, 10.5, BANNER_GREEN, new vec3(0, 0, 0))
    this.makeText(this.bannerRoot, "Banner Title", "SCENE SECURED", 93, true, WHITE, 56, 5, new vec3(0, 1.8, 0.3), HorizontalAlignment.Center, false)
    this.bannerSub = this.makeText(this.bannerRoot, "Banner Time", "", 48, false, WHITE, 56, 3, new vec3(0, -3, 0.3), HorizontalAlignment.Center, false)
    this.bannerRoot.enabled = false
  }

  // ───────────────────────────── Per-frame ─────────────────────────────

  private onUpdate(): void {
    if (this.devices.length === 0) return
    if (!this.ready) {
      this.finishInitWhenReady()
      return
    }
    const dt = getDeltaTime()
    this.updateBillboards()

    const target = this.simulatedGazeActive ? this.simulatedGaze : this.computeGazeTarget()

    // Collapse only after looking clearly away for a while; progress is kept.
    const expanded = this.expandedDev
    if (expanded) {
      if (target === expanded) {
        this.awayTimer = 0
      } else {
        this.awayTimer += dt
        if (this.awayTimer >= this.collapseSeconds) this.collapse(expanded)
      }
    }

    // Dwell on a device that is not expanded yet: trace the ring, then expand.
    if (target && target !== this.expandedDev) {
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
        this.expand(target)
      }
    } else if (this.dwellDev) {
      this.clearDwell()
    }

    if (this.expandedDev) this.updateNextArrow(this.expandedDev)
  }

  private finishInitWhenReady(): void {
    this.initFrames++
    if (this.initFrames < 3) return
    let allReady = true
    const buttons: Button[] = this.devices.map((d) => d.doneButton).concat([this.logChipButton])
    for (const b of buttons) {
      let ok = false
      try {
        ok = !!b.interactable
      } catch (e) {
        ok = false
      }
      if (!ok) allReady = false
    }
    if (!allReady && this.initFrames < 120) return

    for (const dev of this.devices) {
      dev.stackRoot.getTransform().setLocalScale(new vec3(1, 1, 1))
      dev.stackRoot.enabled = false
    }
    this.logRoot.getTransform().setLocalScale(new vec3(1, 1, 1))
    this.logRoot.enabled = false
    this.ready = true
    print("[Volatile] ready: " + this.devices.length + " devices, all rank chips grey, no tags shown")
  }

  private updateBillboards(): void {
    const cam = this.camTransform.getWorldPosition()
    for (const t of this.billboards) {
      const d = cam.sub(t.getWorldPosition())
      if (d.x * d.x + d.z * d.z < 0.0001) continue
      t.setWorldRotation(quat.angleAxis(Math.atan2(d.x, d.z), vec3.up()))
    }
  }

  // ───────────────────────────── Gaze ─────────────────────────────

  /** The device the responder is looking at, or null. Stands in for object recognition. */
  private computeGazeTarget(): DeviceUI | null {
    const camPos = this.camTransform.getWorldPosition()
    const camDir = this.camTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const margin = (this.gazeMarginDeg * Math.PI) / 180
    let best: DeviceUI | null = null
    let bestScore = 1
    for (const dev of this.devices) {
      const spheres: {c: vec3; r: number}[] = [{c: this.toWorld(dev.root, dev.def.gazeCenter), r: dev.def.gazeRadius}]
      if (dev.expanded) {
        // The device, its tag, its step stack and its Done button count as one gaze target.
        const up = new vec3(0, -dev.stackHeight / 2, 0)
        spheres.push({c: dev.stackRoot.getTransform().getWorldPosition().add(up), r: Math.max(STACK_WIDTH, dev.stackHeight) / 2 + 3})
        spheres.push({c: dev.tagRoot.getTransform().getWorldPosition(), r: dev.def.tagWidth / 2 + 2})
      }
      for (const s of spheres) {
        const v = s.c.sub(camPos)
        const dist = v.length
        if (dist < 1) continue
        if (!dev.expanded && dist > this.scanRangeCm) continue
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

  private toWorld(obj: SceneObject, local: vec3): vec3 {
    return obj.getTransform().getWorldTransform().multiplyPoint(local)
  }

  // ───────────────────────────── Scan ring ─────────────────────────────

  private placeRing(dev: DeviceUI): void {
    const r = dev.def.gazeRadius
    const segLen = ((2 * Math.PI * r) / RING_SEGMENTS) * 0.8
    for (let i = 0; i < RING_SEGMENTS; i++) {
      // Start at the top and trace clockwise as seen by the responder.
      const a = Math.PI / 2 - (i / RING_SEGMENTS) * 2 * Math.PI
      const t = this.ringSegments[i].getTransform()
      t.setLocalPosition(new vec3(Math.cos(a) * r, Math.sin(a) * r, 0))
      t.setLocalRotation(quat.angleAxis(a + Math.PI / 2, vec3.forward()))
      t.setLocalScale(new vec3(segLen, 0.35, 0.15))
    }
    this.ringRoot.getTransform().setWorldPosition(this.toWorld(dev.root, dev.def.gazeCenter))
    this.ringRoot.enabled = true
  }

  private faceRingToCamera(): void {
    const t = this.ringRoot.getTransform()
    const d = this.camTransform.getWorldPosition().sub(t.getWorldPosition())
    if (d.length < 0.01) return
    t.setWorldRotation(quat.lookAt(d.normalize(), vec3.up()))
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

  // ───────────────────────────── Expand / collapse ─────────────────────────────

  private expand(dev: DeviceUI): void {
    if (this.expandedDev && this.expandedDev !== dev) this.collapse(this.expandedDev)
    dev.expanded = true
    this.expandedDev = dev
    this.awayTimer = 0
    dev.chipRoot.enabled = false
    dev.tagRoot.enabled = true
    dev.stackRoot.enabled = true
    this.refreshDevice(dev)
    print("[Volatile] expanded " + dev.def.id + ", active step " + (this.activeIndex(dev) + 1))
  }

  private collapse(dev: DeviceUI): void {
    dev.expanded = false
    dev.tagRoot.enabled = false
    dev.stackRoot.enabled = false
    dev.chipRoot.enabled = true
    if (this.expandedDev === dev) this.expandedDev = null
    this.awayTimer = 0
    print("[Volatile] collapsed " + dev.def.id + " (progress kept: " + dev.completed + "/" + dev.def.steps.length + ")")
  }

  // ───────────────────────────── Steps and custody ─────────────────────────────

  private activeIndex(dev: DeviceUI): number {
    return dev.completed < dev.def.steps.length ? dev.completed : -1
  }

  /** The only path that completes a step. Always completes the current step, never a later one. */
  private onDonePinched(dev: DeviceUI): void {
    if (!this.ready || !dev.expanded) return
    const index = this.activeIndex(dev)
    if (index < 0) return

    const step = dev.def.steps[index]
    const time = this.clockTime()
    const entry: CustodyEntry = {
      time,
      deviceId: dev.def.id,
      deviceName: dev.def.name,
      action: step.logged,
      line: time + ", " + dev.def.name + " (" + dev.def.id + "), " + step.logged + "."
    }
    this.custody.push(entry)
    dev.completed++
    dev.custodyText.text = entry.line
    print("[Volatile] custody: " + entry.line)

    this.play(this.clickAudio)
    this.refreshDevice(dev)
    this.refreshLog()

    if (dev.completed >= dev.def.steps.length) {
      print("[Volatile] device finished: " + dev.def.id)
      this.playChimeSoon()
      if (this.devices.every((d) => d.completed >= d.def.steps.length)) this.secureScene()
    }
  }

  private secureScene(): void {
    if (this.secured) return
    this.secured = true
    const total = Math.max(0, Math.floor(getTime() - this.startTime))
    const mm = Math.floor(total / 60)
    const ss = total % 60
    this.bannerText = "Scene secured — total time " + this.pad(mm) + ":" + this.pad(ss)
    this.bannerSub.text = "Total time " + this.pad(mm) + ":" + this.pad(ss)
    this.bannerRoot.enabled = true
    print("[Volatile] " + this.bannerText)
  }

  private clockTime(): string {
    const d = new Date()
    return this.pad(d.getHours()) + ":" + this.pad(d.getMinutes()) + ":" + this.pad(d.getSeconds())
  }

  private pad(n: number): string {
    return (n < 10 ? "0" : "") + n
  }

  private play(audio: AudioComponent): void {
    if (audio && audio.audioTrack) audio.play(1)
  }

  private playChimeSoon(): void {
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => this.play(this.chimeAudio))
    ev.reset(0.25)
  }

  // ───────────────────────────── Refresh visuals ─────────────────────────────

  private chipState(dev: DeviceUI): ChipState {
    if (dev.completed >= dev.def.steps.length) return "done"
    return dev.completed > 0 ? "in_progress" : "untouched"
  }

  private nextDevice(): DeviceUI | null {
    for (const d of this.devices) if (d.completed < d.def.steps.length) return d
    return null
  }

  private refreshDevice(dev: DeviceUI): void {
    const state = this.chipState(dev)
    dev.chipPlate.mat.mainPass.baseColor = state === "done" ? CHIP_GREEN : state === "in_progress" ? CHIP_AMBER : CHIP_GREY
    dev.chipText.text = "#" + dev.def.rank + (state === "done" ? " " + CHECK : "")
    dev.chipPlate.obj.getTransform().setLocalScale(new vec3(state === "done" ? 6.6 : 5, 2.7, 0.15))

    const active = this.activeIndex(dev)
    let y = -1
    for (let i = 0; i < dev.rows.length; i++) {
      const row = dev.rows[i]
      const done = i < dev.completed
      const label = i + 1 + ". " + dev.def.steps[i].label
      row.text.text = done ? CHECK + " " + label : label
      row.text.textFill.color = done ? GREEN_TEXT : i === active ? WHITE : DIM
      row.text.weight = i === active ? 700 : 500
      row.highlight.enabled = i === active
      row.root.getTransform().setLocalPosition(new vec3(0, y - row.height / 2, 0.7))
      y -= row.height + 0.3
      if (i === active) {
        // The Done button sits right under the active step and moves down as steps complete.
        dev.doneObj.getTransform().setLocalPosition(new vec3(0, y - 0.3 - DONE_H / 2, 0.9))
        y -= DONE_H + 0.9
      }
    }
    dev.doneObj.enabled = active >= 0

    dev.custodyObj.getTransform().setLocalPosition(new vec3(0, y - 0.3 - 2.1, 0.9))
    y -= 4.8

    const finished = active < 0
    dev.nextRoot.enabled = finished
    if (finished) {
      const next = this.nextDevice()
      dev.nextText.text = next ? "NEXT: #" + next.def.rank + " " + next.def.name : "ALL DEVICES DONE"
      dev.nextRoot.getTransform().setLocalPosition(new vec3(0, y - 1.4, 0.9))
      y -= 3
    }

    dev.stackHeight = -y + 0.6
    dev.plate.size = new vec2(STACK_WIDTH, dev.stackHeight)
    dev.plateObj.getTransform().setLocalPosition(new vec3(0, -dev.stackHeight / 2, 0))
  }

  /** Arrow attached to the finished device's stack, pointing at the next device when it is out of view. */
  private updateNextArrow(dev: DeviceUI): void {
    if (!dev.nextRoot.enabled) return
    const next = this.nextDevice()
    if (!next) {
      dev.arrowRoot.enabled = false
      return
    }
    const camPos = this.camTransform.getWorldPosition()
    const camDir = this.camTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const nextPos = this.toWorld(next.root, next.def.gazeCenter)
    const toNext = nextPos.sub(camPos).normalize()
    const outOfView = Math.acos(Math.max(-1, Math.min(1, toNext.dot(camDir)))) > (20 * Math.PI) / 180
    dev.arrowRoot.enabled = outOfView
    if (!outOfView) return
    const local = dev.stackRoot.getTransform().getInvertedWorldTransform().multiplyPoint(nextPos)
    const origin = dev.arrowRoot.getTransform().getWorldPosition()
    const localOrigin = dev.stackRoot.getTransform().getInvertedWorldTransform().multiplyPoint(origin)
    const angle = Math.atan2(local.y - localOrigin.y, local.x - localOrigin.x)
    dev.arrowRoot.getTransform().setLocalRotation(quat.angleAxis(angle, vec3.forward()))
  }

  private refreshLog(): void {
    this.logTitle.text = "CUSTODY LOG (" + this.custody.length + ")"
    if (this.custody.length === 0) {
      this.logBody.text = "No entries yet."
      return
    }
    this.logBody.text = this.custody.map((e) => e.time + "  " + e.deviceId + "  " + e.action).join("\n")
  }

  private toggleLog(): void {
    if (!this.ready) return
    this.logOpen = !this.logOpen
    this.logRoot.enabled = this.logOpen
    print("[Volatile] custody log " + (this.logOpen ? "opened" : "closed") + " with " + this.custody.length + " entries")
  }

  // ───────────────────────────── Read-only state (used by tests) ─────────────────────────────

  private find(id: string): DeviceUI | null {
    for (const d of this.devices) if (d.def.id === id) return d
    return null
  }

  isReady(): boolean {
    return this.ready
  }

  getDeviceIds(): string[] {
    return this.devices.map((d) => d.def.id)
  }

  getChipState(id: string): ChipState {
    return this.chipState(this.find(id))
  }

  isExpanded(id: string): boolean {
    return this.find(id).expanded
  }

  /** True once the scan ring has fully traced around this device at least once. */
  hasRingTraced(id: string): boolean {
    return this.find(id).ringTraced
  }

  getRingProgress(): number {
    return this.ringProgress
  }

  /** Zero-based index of the active step, or -1 when every step is done. */
  getActiveStepIndex(id: string): number {
    return this.activeIndex(this.find(id))
  }

  getCompletedCount(id: string): number {
    return this.find(id).completed
  }

  getStepCount(id: string): number {
    return this.find(id).def.steps.length
  }

  getCustodyLog(): CustodyEntry[] {
    return this.custody.slice()
  }

  isLogOpen(): boolean {
    return this.logOpen
  }

  isSceneSecured(): boolean {
    return this.secured
  }

  getBannerText(): string {
    return this.bannerText
  }

  /**
   * Simulate where the responder is looking. LEAF cannot move the head, so tests use this in
   * place of head pose; the dwell timer, ring, expand and collapse logic all still run.
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
}
