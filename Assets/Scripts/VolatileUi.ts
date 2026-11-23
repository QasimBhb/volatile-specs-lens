import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {GradientParameters, RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

/**
 * Volatile — drawing helpers and the "Forensic Tag" palette.
 *
 * Colour means state only. Red: never do. Amber: in progress, problem, contested.
 * Green: done. Cyan: the active step and what you are aiming at. White: text.
 * The display is additive (black is transparent), so panel fills stay between about
 * 10% and 30% brightness and text stays light.
 */

// Three text sizes only.
export const T_LARGE = 56
export const T_BODY = 44
export const T_CAPTION = 40


export const WHITE = new vec4(1, 1, 1, 1)
export const DIM = new vec4(0.66, 0.69, 0.74, 1)
export const SOFT = new vec4(0.78, 0.81, 0.86, 1)
export const CYAN = new vec4(0.45, 0.9, 1, 1)
export const GREEN = new vec4(0.5, 0.95, 0.62, 1)
export const AMBER = new vec4(1, 0.68, 0.2, 1)
export const GREY_BORDER = new vec4(0.5, 0.54, 0.6, 1)
export const RED_BORDER = new vec4(0.98, 0.4, 0.35, 1)
export const RED_TEXT = new vec4(1, 0.78, 0.75, 1)
export const ASSESSED_BORDER = new vec4(0.86, 0.89, 0.94, 1)

export const PLATE_A = new vec4(0.1, 0.12, 0.16, 1)
export const PLATE_B = new vec4(0.2, 0.24, 0.3, 1)
export const PLATE_EDGE = new vec4(0.36, 0.41, 0.48, 1)
export const ROW_ACTIVE = new vec4(0.2, 0.25, 0.32, 1)
export const CHIP_FILL = new vec4(0.13, 0.16, 0.2, 1)
export const CRIMSON_A = new vec4(0.27, 0.08, 0.08, 1)
export const CRIMSON_B = new vec4(0.42, 0.12, 0.12, 1)
export const BADGE_RED = new vec4(0.72, 0.17, 0.15, 1)
export const BTN_A = new vec4(0.3, 0.36, 0.45, 1)
export const BTN_B = new vec4(0.4, 0.47, 0.58, 1)
export const BTN_LIT_A = new vec4(0.36, 0.43, 0.54, 1)
export const BTN_LIT_B = new vec4(0.48, 0.56, 0.68, 1)
export const GREEN_A = new vec4(0.08, 0.2, 0.13, 1)
export const GREEN_B = new vec4(0.12, 0.3, 0.19, 1)
export const GREEN_BORDER = new vec4(0.4, 0.9, 0.55, 1)

export const CHECK = "✓"

export type PanelOpts = {
  fill?: vec4
  gradient?: [vec4, vec4]
  border?: vec4
  borderSize?: number
  radius: number
}

export type UiButton = {
  obj: SceneObject
  button: Button
  label: Text
}

export function child(parent: SceneObject, name: string, pos: vec3): SceneObject {
  const o = global.scene.createSceneObject(name)
  o.setParent(parent)
  o.getTransform().setLocalPosition(pos)
  return o
}

function linear(a: vec4, b: vec4): GradientParameters {
  return {
    type: "Linear",
    start: new vec2(-1, 1),
    end: new vec2(1, -1),
    stop0: {enabled: true, color: a, percent: 0},
    stop1: {enabled: true, color: b, percent: 1}
  }
}

/** A UI Kit rounded rectangle. Create the plate before its content so it draws first. */
export function panel(parent: SceneObject, name: string, w: number, h: number, pos: vec3, opts: PanelOpts): RoundedRectangle {
  const o = child(parent, name, pos)
  const rr = o.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rr.initialize()
  rr.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto
  rr.size = new vec2(w, h)
  rr.cornerRadius = opts.radius
  if (opts.gradient) {
    rr.gradient = true
    rr.setBackgroundGradient(linear(opts.gradient[0], opts.gradient[1]))
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

/** Move and resize a panel. `pos` is its centre. */
export function placePanel(rr: RoundedRectangle, w: number, h: number, pos: vec3): void {
  rr.size = new vec2(w, h)
  rr.getSceneObject().getTransform().setLocalPosition(pos)
}

export function text(
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
  const o = child(parent, name, pos)
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

/** Move a text and give it a new box. `pos` is the centre of the box. */
export function placeText(t: Text, w: number, h: number, pos: vec3): void {
  t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  t.getSceneObject().getTransform().setLocalPosition(pos)
}

/** Height in cm of one line at this text size (measured in the preview: size 44 is 1.25 cm). */
export function lineHeight(size: number): number {
  return size * 0.0285
}

/**
 * Set a wrapped text in a box `w` cm wide and return the height it takes, measured by
 * Lens Studio. The text's object must be enabled, with every ancestor enabled.
 */
export function setWrapped(t: Text, str: string, w: number): number {
  const one = lineHeight(t.size)
  t.horizontalOverflow = HorizontalOverflow.Wrap
  t.layoutRect = Rect.create(-w / 2, w / 2, -20, 20)
  t.text = str
  if (str.length === 0) return one
  try {
    const bb = t.getBoundingBox()
    const h = bb.top - bb.bottom
    return h > one * 0.5 ? Math.max(h, one) : one
  } catch (e) {
    return one
  }
}

/** Set `str` on one line and return its width in cm. */
export function setLine(t: Text, str: string): number {
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.text = str
  try {
    const bb = t.getBoundingBox()
    return bb.right - bb.left
  } catch (e) {
    return str.length * t.size * 0.0105
  }
}

/** Set `str` on one line, cut to `w` cm and ending in "…" if anything was cut. */
export function setFitted(t: Text, str: string, w: number): void {
  let s = str
  let width = setLine(t, s)
  for (let i = 0; i < 12 && width > w && s.length > 4; i++) {
    const keep = Math.max(4, Math.floor((s.length * w) / width) - 2)
    s = s.substring(0, keep).replace(/[\s,.:;]+$/, "") + "…"
    width = setLine(t, s)
  }
}

/**
 * A UI Kit Button recoloured slate with a cyan border when aimed at. Hover and pinch
 * feedback come from UI Kit. `onPinch` runs once per pinch.
 */
export function button(parent: SceneObject, name: string, label: string, w: number, h: number, pos: vec3, onPinch: () => void): UiButton {
  const o = child(parent, name, pos)
  const btn = o.createComponent(Button.getTypeName()) as Button
  const size = new vec3(w, h, 1)
  btn.size = size
  btn.onInitialized.add(() => {
    btn.size = size
    try {
      const v = btn.visual as any
      v.defaultGradient = linear(BTN_B, BTN_A)
      v.hoveredGradient = linear(BTN_LIT_B, BTN_LIT_A)
      v.triggeredGradient = linear(BTN_LIT_B, BTN_LIT_A)
      // Each state carries its own border type; without these a hover brings back UI Kit's yellow border.
      v.defaultBorderType = "Color"
      v.hoveredBorderType = "Color"
      v.triggeredBorderType = "Color"
      v.isBorderGradient = false
      v.borderDefaultColor = GREY_BORDER
      v.borderHoveredColor = CYAN
      v.borderTriggeredColor = CYAN
      v.cornerRadius = h / 2
      if (typeof v.refreshRoundedRectangleState === "function") v.refreshRoundedRectangleState()
    } catch (e) {
      print("[Volatile] could not restyle button " + name + ": " + e)
    }
  })
  const t = text(o, name + " Label", label, T_BODY, true, WHITE, w - 1, h - 0.6, new vec3(0, 0, 0.2), HorizontalAlignment.Center, true)
  btn.onTriggerUp.add(onPinch)
  return {obj: o, button: btn, label: t}
}

/** True once a UI Kit button has finished initialising. */
export function buttonReady(b: UiButton): boolean {
  try {
    return !!b.button.interactable
  } catch (e) {
    return false
  }
}

/** Rotation whose local Y and Z are the given orthonormal world axes (X follows, right-handed). */
export function basis(y: vec3, z: vec3): quat {
  const q1 = quat.rotationFromTo(vec3.forward(), z)
  const y1 = q1.multiplyVec3(vec3.up())
  const cos = Math.max(-1, Math.min(1, y1.dot(y)))
  let angle = Math.acos(cos)
  if (y1.cross(y).dot(z) < 0) angle = -angle
  return quat.angleAxis(angle, z).multiply(q1)
}

/**
 * "Up" as the responder sees it, with any head roll removed. Panels use this rather than world
 * up, so they stay upright in view when the head is pitched down at the desk.
 */
export function viewUp(camRotation: quat): vec3 {
  const forward = camRotation.multiplyVec3(new vec3(0, 0, -1))
  const up = vec3.up().sub(forward.uniformScale(vec3.up().dot(forward)))
  if (up.length < 0.05) return camRotation.multiplyVec3(vec3.up())
  return up.normalize()
}

/** Turn a panel fully toward the camera, upright in the responder's view. */
export function faceCamera(t: Transform, cam: vec3, up: vec3): void {
  const z = cam.sub(t.getWorldPosition())
  if (z.length < 0.01) return
  const zn = z.normalize()
  const u = up.sub(zn.uniformScale(up.dot(zn)))
  if (u.length < 0.001) return
  t.setWorldRotation(basis(u.normalize(), zn))
}

export function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n
}

/** "00:04:12" from a number of seconds. */
export function hms(total: number): string {
  const s = Math.max(0, Math.floor(total))
  return pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60)) + ":" + pad2(s % 60)
}

/** "04:12" from a number of seconds. */
export function ms(total: number): string {
  const s = Math.max(0, Math.floor(total))
  return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60)
}
