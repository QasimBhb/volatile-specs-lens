import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {GradientParameters, RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

/**
 * Volatile — look proof (throwaway).
 *
 * Draws the "Forensic Tag" look on the laptop stand-in (strip, rank marker, step card with two
 * fact buttons and a source chip) and a rank marker on the phone, so it can be compared with
 * version 1 from the same camera position. It pauses the version 1 controller, hides its
 * panels and dims the stand-ins at runtime only; nothing on disk is changed.
 * Disable this object to get version 1 back.
 */

// Three text sizes only: Snap's 110 cm presets scaled up about 15% for a desk about 120 cm away.
const T_LARGE = 56
const T_BODY = 44
const T_CAPTION = 40

// Colour means state only. Cyan: active or aimed at. White: text.
const WHITE = new vec4(1, 1, 1, 1)
const DIM = new vec4(0.66, 0.69, 0.74, 1)
const CYAN = new vec4(0.45, 0.9, 1, 1)
const GREEN = new vec4(0.5, 0.95, 0.62, 1)
const AMBER = new vec4(1, 0.68, 0.2, 1)
const GREY_BORDER = new vec4(0.5, 0.54, 0.6, 1)
const RED_BORDER = new vec4(0.98, 0.4, 0.35, 1)
const ASSESSED_BORDER = new vec4(0.86, 0.89, 0.94, 1)

const PLATE_A = new vec4(0.1, 0.12, 0.16, 1)
const PLATE_B = new vec4(0.2, 0.24, 0.3, 1)
const PLATE_EDGE = new vec4(0.36, 0.41, 0.48, 1)
const ROW_ACTIVE = new vec4(0.2, 0.25, 0.32, 1)
const CRIMSON_A = new vec4(0.27, 0.08, 0.08, 1)
const CRIMSON_B = new vec4(0.42, 0.12, 0.12, 1)
const BTN_A = new vec4(0.3, 0.36, 0.45, 1)
const BTN_B = new vec4(0.4, 0.47, 0.58, 1)

const CARD_W = 20
const PAD = 1
const BTN_W = 8.6
const BTN_H = 5

type PanelOpts = {
  fill?: vec4
  gradient?: [vec4, vec4]
  border?: vec4
  borderSize?: number
  radius: number
}

@component
export class VolatileLookProof extends BaseScriptComponent {
  private built: boolean = false
  private frames: number = 0
  private controller: any = null
  private camTransform: Transform | null = null
  private billboards: Transform[] = []
  private facers: Transform[] = []

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onUpdate(): void {
    if (this.built) {
      this.updateBillboards()
      return
    }
    this.frames++
    const volatile = this.findByName("Volatile")
    if (!volatile) return
    if (!this.controller) this.controller = this.findController(volatile)
    let ready = false
    try {
      ready = !!this.controller && this.controller.isReady()
    } catch (e) {
      ready = false
    }
    // Wait for version 1 to finish initialising its UI Kit buttons before touching it.
    if (!ready && this.frames < 240) return
    this.built = true
    try {
      this.build(volatile)
    } catch (e) {
      print("[LookProof] build failed: " + e)
    }
  }

  private build(volatile: SceneObject): void {
    const laptop = this.findIn(volatile, "Laptop LAP-01 (preview stand-in)")
    const phone = this.findIn(volatile, "Phone PH-01 (preview stand-in)")
    const camObj = this.controller && this.controller.cameraObject ? this.controller.cameraObject : this.findByName("Camera Object")
    this.camTransform = camObj ? camObj.getTransform() : null

    // Pause version 1 and hide its panels (runtime only).
    if (this.controller) this.controller.enabled = false
    this.hideVersion1(volatile)
    this.dimStandIns(volatile)

    this.buildLaptopScreen(laptop)
    this.buildPhoneScreen(phone)
    this.buildStrip(laptop)
    this.buildCard(laptop)
    this.buildPhoneTag(phone)
    this.updateBillboards()
    print("[LookProof] Forensic Tag proof built")
  }

  // ───────────────────────────── Version 1 and stand-ins ─────────────────────────────

  private findController(root: SceneObject): any {
    const comps = root.getComponents("Component.ScriptComponent") as any[]
    for (const c of comps) {
      if (c && typeof c.isReady === "function" && typeof c.setSimulatedGaze === "function") return c
    }
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const hit = this.findController(root.getChild(i))
      if (hit) return hit
    }
    return null
  }

  private hideVersion1(obj: SceneObject): void {
    const n = obj.name
    if (n.indexOf("RankChip ") === 0 || n.indexOf("Tag ") === 0 || n.indexOf("StepStack ") === 0 || n === "ScanRing" || n === "LogChip") {
      obj.enabled = false
      return
    }
    for (let i = 0; i < obj.getChildrenCount(); i++) this.hideVersion1(obj.getChild(i))
  }

  /** Dim the stand-in shapes so the interface is the brightest thing in view. */
  private dimStandIns(obj: SceneObject): void {
    const n = obj.name
    const isPart = n.indexOf("Laptop ") === 0 || n.indexOf("Phone ") === 0 || n.indexOf("USB ") === 0 || n.indexOf("Router ") === 0 || n.indexOf("Desk ") === 0
    if (isPart && n.indexOf("Lights") >= 0) {
      const led = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (led && led.mainMaterial) {
        const lm = led.mainMaterial.clone()
        lm.mainPass.baseColor = new vec4(0.55, 0.66, 0.8, 1)
        led.mainMaterial = lm
      }
    }
    if (isPart && n.indexOf("Lights") < 0) {
      const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (rmv && rmv.mainMaterial) {
        const m = rmv.mainMaterial.clone()
        const c = m.mainPass.baseColor as vec4
        if (n.indexOf("Screen") >= 0) {
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
    if (!screen || !this.camTransform) return null
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
    const a = others[0]
    const b = others[1]
    const aIsWidth = Math.abs(axes[a].dot(right)) > Math.abs(axes[b].dot(right))
    const w = aIsWidth ? lens[a] : lens[b]
    const h = aIsWidth ? lens[b] : lens[a]

    const frame = global.scene.createSceneObject("Proof " + screenName)
    frame.setParent(root)
    const ft = frame.getTransform()
    ft.setWorldScale(new vec3(1, 1, 1))
    ft.setWorldRotation(this.basis(right, up, normal))
    ft.setWorldPosition(pos.add(normal.uniformScale(lens[ni] / 2 + 0.08)))
    frame.createComponent("Component.Canvas")
    print("[LookProof] " + screenName + " face " + w.toFixed(1) + " x " + h.toFixed(1) + " cm, flat=" + flat)
    return {frame, w, h}
  }

  /** Rotation whose local X, Y, Z are the given orthonormal world axes. */
  private basis(x: vec3, y: vec3, z: vec3): quat {
    const q1 = quat.rotationFromTo(vec3.forward(), z)
    const y1 = q1.multiplyVec3(vec3.up())
    const cos = Math.max(-1, Math.min(1, y1.dot(y)))
    let angle = Math.acos(cos)
    if (y1.cross(y).dot(z) < 0) angle = -angle
    const q = quat.angleAxis(angle, z).multiply(q1)
    // x is implied by y and z for a right-handed frame.
    return q
  }

  private buildLaptopScreen(laptop: SceneObject): void {
    const s = this.screenFrame(laptop, "Laptop Screen (on)")
    if (!s) return
    const f = s.frame
    // A dim desktop: wallpaper, a window, icons and a taskbar. Flat shapes only.
    this.panel(f, "Wallpaper", s.w, s.h, new vec3(0, 0, 0), {gradient: [new vec4(0.1, 0.18, 0.32, 1), new vec4(0.16, 0.3, 0.45, 1)], radius: 0.3})
    this.panel(f, "Window", s.w * 0.46, s.h * 0.5, new vec3(s.w * 0.14, s.h * 0.08, 0.05), {fill: new vec4(0.22, 0.28, 0.36, 1), border: new vec4(0.4, 0.48, 0.58, 1), borderSize: 0.08, radius: 0.4})
    this.panel(f, "Window Bar", s.w * 0.46, s.h * 0.07, new vec3(s.w * 0.14, s.h * 0.08 + s.h * 0.215, 0.1), {fill: new vec4(0.34, 0.41, 0.5, 1), radius: 0.3})
    for (let i = 0; i < 4; i++) {
      this.panel(f, "Icon " + i, 1.5, 1.5, new vec3(-s.w / 2 + 2, s.h / 2 - 2.2 - i * 2.6, 0.05), {fill: new vec4(0.34, 0.45, 0.58, 1), radius: 0.35})
    }
    this.panel(f, "Taskbar", s.w, s.h * 0.085, new vec3(0, -s.h / 2 + s.h * 0.0425, 0.05), {fill: new vec4(0.2, 0.25, 0.32, 1), radius: 0.2})
  }

  private buildPhoneScreen(phone: SceneObject): void {
    const s = this.screenFrame(phone, "Phone Screen (on)")
    if (!s) return
    const f = s.frame
    this.panel(f, "Lock Wallpaper", s.w, s.h, new vec3(0, 0, 0), {gradient: [new vec4(0.12, 0.14, 0.26, 1), new vec4(0.22, 0.18, 0.34, 1)], radius: 0.6})
    this.text(f, "Lock Time", "14:32", T_LARGE, true, new vec4(0.92, 0.94, 0.97, 1), s.w, 2.2, new vec3(0, s.h * 0.2, 0.1), HorizontalAlignment.Center, false)
    this.text(f, "Lock Hint", "Locked", T_CAPTION, false, new vec4(0.7, 0.73, 0.78, 1), s.w, 1.6, new vec3(0, s.h * 0.2 - 2, 0.1), HorizontalAlignment.Center, false)
  }

  // ───────────────────────────── Forensic Tag pieces ─────────────────────────────

  /** Rank marker: a numbered scene-marker shape. The border carries the state colour. */
  private buildMarker(parent: SceneObject, name: string, pos: vec3, numeral: string, state: vec4, billboard: boolean): SceneObject {
    const root = this.child(parent, name, pos)
    root.createComponent("Component.Canvas")
    const size = 5.6
    this.panel(root, "Marker Plate", size, size, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: state, borderSize: 0.22, radius: 0.6})
    this.text(root, "Marker Numeral", numeral, T_LARGE, true, WHITE, size, 3, new vec3(0, 0.35, 0.1), HorizontalAlignment.Center, false)
    this.panel(root, "Marker Foot", 2.6, 0.32, new vec3(0, -1.75, 0.1), {fill: state, radius: 0.16})
    if (billboard) this.billboards.push(root.getTransform())
    return root
  }

  /** Collapsed phone: marker plus a reason pill that also carries the seizure clock. */
  private buildPhoneTag(phone: SceneObject): void {
    const pillW = 16.5
    const h = 5.6
    const root = this.child(phone, "PhoneTag", new vec3(-6, 6, -11))
    this.facers.push(root.getTransform())
    this.buildMarker(root, "PhoneMarker", new vec3(pillW / 2 + 0.3, 0, 0), "2", ASSESSED_BORDER, false)
    const pill = this.child(root, "PhonePill", new vec3(-2.8 - 0.3, 0, 0))
    pill.createComponent("Component.Canvas")
    this.panel(pill, "Pill Plate", pillW, h, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 0.9})
    this.text(pill, "Pill Reason", "locked, could reboot or be wiped", T_CAPTION, false, WHITE, pillW - 1.6, 3, new vec3(0, 0.95, 0.1), HorizontalAlignment.Left, true)
    this.text(pill, "Pill Clock", "Locked for at least 00:04:12", T_CAPTION, true, AMBER, pillW - 1.6, 1.5, new vec3(0, -1.75, 0.1), HorizontalAlignment.Left, false)
  }

  /** "Never do" strip on the top edge of the lid, with the rank marker at its left end. */
  private buildStrip(laptop: SceneObject): void {
    const lidW = 33
    const markerW = 5.6
    const gap = 0.6
    const stripW = lidW - markerW - gap
    const h = 5.6
    const y = 25.8 + h / 2
    const z = -16.5
    const tag = this.child(laptop, "LidTag", new vec3(0, y, z))
    this.facers.push(tag.getTransform())
    this.buildMarker(tag, "LaptopMarker", new vec3(-lidW / 2 + markerW / 2, 0, 0), "1", AMBER, false)

    const root = this.child(tag, "NeverDoStrip", new vec3(-lidW / 2 + markerW + gap + stripW / 2, 0, 0))
    root.createComponent("Component.Canvas")
    this.panel(root, "Strip Plate", stripW, h, new vec3(0, 0, 0), {gradient: [CRIMSON_A, CRIMSON_B], border: RED_BORDER, borderSize: 0.16, radius: 0.9})
    // Warning mark: a round badge with "!".
    this.panel(root, "Warning Badge", 2.6, 2.6, new vec3(-stripW / 2 + 2.3, 0.75, 0.1), {fill: new vec4(0.72, 0.17, 0.15, 1), border: RED_BORDER, borderSize: 0.14, radius: 1.3})
    this.text(root, "Warning Mark", "!", T_BODY, true, WHITE, 2.6, 2.6, new vec3(-stripW / 2 + 2.3, 0.75, 0.2), HorizontalAlignment.Center, false)
    const textW = stripW - 5
    this.text(root, "Strip Headline", "DON'T SHUT DOWN. DON'T TYPE OR CLICK.", T_BODY, true, WHITE, textW, 2, new vec3(1.9, 0.85, 0.1), HorizontalAlignment.Left, false)
    this.text(root, "Strip Source", "NIJ 2008  ·  INTERPOL 2021", T_CAPTION, false, new vec4(1, 0.78, 0.75, 1), textW, 1.6, new vec3(1.9, -1.45, 0.1), HorizontalAlignment.Left, false)
  }

  /** Step card: 20 cm wide, 1 cm beside the lid, never over the screen. */
  private buildCard(laptop: SceneObject): void {
    const left = 16.5 + 1
    const root = this.child(laptop, "StepCard", new vec3(left + CARD_W / 2, 31.4, -14))
    root.createComponent("Component.Canvas")
    this.facers.push(root.getTransform())
    const plate = this.panel(root, "Card Plate", CARD_W, 10, new vec3(0, 0, 0), {gradient: [PLATE_A, PLATE_B], border: PLATE_EDGE, borderSize: 0.1, radius: 1.2})
    const innerW = CARD_W - PAD * 2
    let y = -PAD

    // Label-style header: device ID and state.
    this.text(root, "Header Id", "LAP-01", T_BODY, true, WHITE, innerW, 1.8, new vec3(0, y - 0.9, 0.2), HorizontalAlignment.Left, false)
    this.text(root, "Header State", "ON · UNLOCKED", T_CAPTION, true, DIM, innerW, 1.8, new vec3(0, y - 0.9, 0.2), HorizontalAlignment.Right, false)
    y -= 2.3
    this.panel(root, "Header Rule", innerW, 0.08, new vec3(0, y, 0.2), {fill: PLATE_EDGE, radius: 0.04})
    y -= 0.5
    this.text(root, "Reason", "#1  on and unlocked, could lock", T_CAPTION, false, DIM, innerW, 1.6, new vec3(0, y - 0.8, 0.2), HorizontalAlignment.Left, false)
    y -= 2.3

    // Finished steps.
    y = this.row(root, "Step 1", "✓ 1. Photograph the screen", GREEN, false, y)
    y = this.row(root, "Step 2", "✓ 2. Look, don't touch", GREEN, false, y)

    // Active step: lighter row, cyan bar, source chip, stem and two fact buttons.
    const activeTop = y
    const activeH = 3.5 + 2.4 + 2 + BTN_H + 1.6
    this.panel(root, "Active Row", CARD_W - 0.8, activeH, new vec3(0, activeTop - activeH / 2, 0.15), {fill: ROW_ACTIVE, radius: 0.6})
    this.panel(root, "Active Bar", 0.34, activeH - 1, new vec3(-CARD_W / 2 + 0.75, activeTop - activeH / 2, 0.25), {fill: CYAN, radius: 0.17})
    const aw = innerW - 0.9
    const ax = 0.45
    y -= 0.5
    this.text(root, "Step 3", "3. Don't shut down. Call trained personnel.", T_BODY, true, WHITE, aw, 3.2, new vec3(ax, y - 1.6, 0.3), HorizontalAlignment.Left, true)
    y -= 3.5
    const chipW = 8.4
    this.panel(root, "Source Chip", chipW, 1.7, new vec3(-innerW / 2 + 0.9 + chipW / 2, y - 0.85, 0.3), {fill: new vec4(0.13, 0.16, 0.2, 1), border: GREY_BORDER, borderSize: 0.07, radius: 0.85})
    this.text(root, "Source Text", "INTERPOL 2021", T_CAPTION, false, DIM, chipW, 1.6, new vec3(-innerW / 2 + 0.9 + chipW / 2, y - 0.85, 0.4), HorizontalAlignment.Center, false)
    y -= 2.4
    this.text(root, "Stem", "Trained staff:", T_CAPTION, true, WHITE, aw, 1.6, new vec3(ax, y - 0.8, 0.3), HorizontalAlignment.Left, false)
    y -= 2
    const bx = (BTN_W + 0.8) / 2
    this.button(root, "Fact A", "Coming", new vec3(ax - bx + 0.1, y - BTN_H / 2, 0.6))
    this.button(root, "Fact B", "None free", new vec3(ax + bx - 0.1, y - BTN_H / 2, 0.6))
    y -= BTN_H + 1.6

    // Locked step and the latest custody line.
    y -= 0.3
    y = this.row(root, "Step 4", "4. Network", DIM, false, y)
    this.panel(root, "Footer Rule", innerW, 0.08, new vec3(0, y, 0.2), {fill: PLATE_EDGE, radius: 0.04})
    y -= 0.4
    this.text(root, "Custody", "14:32:07   LAP-01   Any visible: No", T_CAPTION, false, new vec4(0.78, 0.81, 0.86, 1), innerW, 1.6, new vec3(0, y - 0.8, 0.2), HorizontalAlignment.Left, false)
    y -= 1.9

    const h = -y + PAD * 0.6
    plate.size = new vec2(CARD_W, h)
    plate.getSceneObject().getTransform().setLocalPosition(new vec3(0, -h / 2, 0))
    print("[LookProof] card " + CARD_W + " x " + h.toFixed(1) + " cm, span from lid left edge " + (16.5 + left + CARD_W).toFixed(1) + " cm")
  }

  private row(root: SceneObject, name: string, label: string, color: vec4, bold: boolean, y: number): number {
    this.text(root, name, label, T_BODY, bold, color, CARD_W - PAD * 2, 1.8, new vec3(0, y - 1, 0.2), HorizontalAlignment.Left, false)
    return y - 2.1
  }

  /** Fact button: UI Kit Button (so hover and pinch feedback come for free), recoloured slate with a cyan hover border. */
  private button(parent: SceneObject, name: string, label: string, pos: vec3): void {
    const o = this.child(parent, name, pos)
    const btn = o.createComponent(Button.getTypeName()) as Button
    const size = new vec3(BTN_W, BTN_H, 1)
    btn.size = size
    const restyle = () => {
      btn.size = size
      try {
        const v = btn.visual as any
        const slate: GradientParameters = {
          type: "Linear",
          start: new vec2(-1, 1),
          end: new vec2(1, -1),
          stop0: {enabled: true, color: BTN_B, percent: 0},
          stop1: {enabled: true, color: BTN_A, percent: 1}
        }
        const lit: GradientParameters = {
          type: "Linear",
          start: new vec2(-1, 1),
          end: new vec2(1, -1),
          stop0: {enabled: true, color: new vec4(0.48, 0.56, 0.68, 1), percent: 0},
          stop1: {enabled: true, color: new vec4(0.36, 0.43, 0.54, 1), percent: 1}
        }
        v.defaultGradient = slate
        v.hoveredGradient = lit
        v.triggeredGradient = lit
        // Each state carries its own border type; without these a hover resets the border to UI Kit's yellow gradient.
        v.defaultBorderType = "Color"
        v.hoveredBorderType = "Color"
        v.triggeredBorderType = "Color"
        v.isBorderGradient = false
        v.borderDefaultColor = GREY_BORDER
        v.borderHoveredColor = CYAN
        v.borderTriggeredColor = CYAN
        v.cornerRadius = BTN_H / 2
        if (typeof v.refreshRoundedRectangleState === "function") v.refreshRoundedRectangleState()
        print("[LookProof] " + name + " restyled, hasBorder=" + v.hasBorder)
      } catch (e) {
        print("[LookProof] " + name + " restyle failed: " + e)
      }
    }
    btn.onInitialized.add(restyle)
    this.text(o, name + " Label", label, T_BODY, true, WHITE, BTN_W - 0.6, 2.4, new vec3(0, 0, 0.2), HorizontalAlignment.Center, false)
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private child(parent: SceneObject, name: string, pos: vec3): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    o.getTransform().setLocalPosition(pos)
    return o
  }

  private panel(parent: SceneObject, name: string, w: number, h: number, pos: vec3, opts: PanelOpts): RoundedRectangle {
    const o = this.child(parent, name, pos)
    const rr = o.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rr.initialize()
    rr.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto
    rr.size = new vec2(w, h)
    rr.cornerRadius = opts.radius
    if (opts.gradient) {
      rr.gradient = true
      rr.setBackgroundGradient({
        type: "Linear",
        start: new vec2(-1, 1),
        end: new vec2(1, -1),
        stop0: {enabled: true, color: opts.gradient[0], percent: 0},
        stop1: {enabled: true, color: opts.gradient[1], percent: 1}
      })
    } else {
      rr.gradient = false
      rr.backgroundColor = opts.fill ? opts.fill : PLATE_A
    }
    const hasBorder = !!opts.border && !!opts.borderSize
    rr.border = hasBorder
    if (hasBorder) {
      rr.borderSize = opts.borderSize
      rr.borderColor = opts.border
    }
    return rr
  }

  private text(parent: SceneObject, name: string, str: string, size: number, bold: boolean, color: vec4, w: number, h: number, pos: vec3, align: HorizontalAlignment, wrap: boolean): Text {
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

  private updateBillboards(): void {
    if (!this.camTransform) return
    const cam = this.camTransform.getWorldPosition()
    for (const t of this.billboards) {
      const d = cam.sub(t.getWorldPosition())
      if (d.x * d.x + d.z * d.z < 0.0001) continue
      t.setWorldRotation(quat.angleAxis(Math.atan2(d.x, d.z), vec3.up()))
    }
    // Full facing: yaw and pitch toward the camera, no roll.
    for (const t of this.facers) {
      const z = cam.sub(t.getWorldPosition()).normalize()
      let up = vec3.up()
      up = up.sub(z.uniformScale(up.dot(z)))
      if (up.length < 0.001) continue
      up = up.normalize()
      t.setWorldRotation(this.basis(up.cross(z).normalize(), up, z))
    }
  }

  private findByName(name: string): SceneObject | null {
    const count = global.scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      const hit = this.findIn(global.scene.getRootObject(i), name)
      if (hit) return hit
    }
    return null
  }

  private findIn(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) return obj
    const n = obj.getChildrenCount()
    for (let i = 0; i < n; i++) {
      const hit = this.findIn(obj.getChild(i), name)
      if (hit) return hit
    }
    return null
  }
}
