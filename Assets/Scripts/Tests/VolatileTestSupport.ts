import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {VolatileController} from "../VolatileController"

export const DEVICE_IDS = ["LAP-01", "NET-01", "PH-01", "USB-01"]

/** Shared helpers for the Volatile LEAF scenarios. */
export class VolatileTestSupport {
  readonly controller: VolatileController
  private interactor = new DefaultLeafInteractor()

  constructor() {
    const root = findSceneObjectByName("Volatile")
    if (!root) throw new Error('Scene object "Volatile" not found')
    this.controller = root.getComponent(VolatileController.getTypeName()) as VolatileController
    if (!this.controller) throw new Error("VolatileController not found on Volatile")
  }

  async waitUntil(condition: () => boolean, timeoutMs: number, what: string): Promise<void> {
    let waited = 0
    while (!condition()) {
      if (waited >= timeoutMs) throw new Error("Timed out after " + timeoutMs + " ms waiting for " + what)
      await sleep(50)
      waited += 50
    }
  }

  async waitReady(): Promise<void> {
    await this.waitUntil(() => this.controller.isReady(), 5000, "the Lens to finish initialising")
  }

  /**
   * Look at a device until it has expanded. LEAF cannot turn the responder's head, so this sets
   * the simulated gaze; the Lens's own dwell timer, ring and expand logic do the rest.
   */
  async lookAt(id: string): Promise<void> {
    this.controller.setSimulatedGaze(id)
    await this.waitUntil(() => this.controller.isExpanded(id), 4000, id + " to expand after gaze dwell")
    await sleep(100)
  }

  /** Look at nothing until every device has collapsed back to its chip. */
  async lookAway(): Promise<void> {
    this.controller.setSimulatedGaze("away")
    await this.waitUntil(() => DEVICE_IDS.every((id) => !this.controller.isExpanded(id)), 5000, "all devices to collapse")
  }

  /** Give gaze back to the real camera. */
  releaseGaze(): void {
    this.controller.setSimulatedGaze(null)
  }

  /** Pinch the real Done button (a UI Kit Button) under the active step of a device. */
  async pinchDone(id: string): Promise<void> {
    const button = findInteractableByName("DoneButton " + id, undefined, true)
    if (!button) throw new Error('Enabled interactable "DoneButton ' + id + '" not found')
    await this.interactor.trigger(button)
    await sleep(300)
  }

  /** Pinch the real Log chip on the desk. */
  async pinchLogChip(): Promise<void> {
    const chip = findInteractableByName("LogChip", undefined, true)
    if (!chip) throw new Error('Enabled interactable "LogChip" not found')
    await this.interactor.trigger(chip)
    await sleep(300)
  }

  object(name: string): SceneObject {
    const o = findSceneObjectByName(name)
    if (!o) throw new Error('Scene object "' + name + '" not found')
    return o
  }

  /** Text of the first Text component on, or under, the named object. */
  textOf(name: string, childName?: string): string {
    const o = childName ? findSceneObjectByName(childName, this.object(name)) : this.object(name)
    if (!o) throw new Error('"' + childName + '" not found under "' + name + '"')
    const t = o.getComponent("Component.Text") as Text
    if (!t) throw new Error('No Text on "' + o.name + '"')
    return t.text
  }

  /** Base colour of the named plate under the named object. */
  plateColor(name: string, plateName: string): vec4 {
    const o = findSceneObjectByName(plateName, this.object(name))
    if (!o) throw new Error('"' + plateName + '" not found under "' + name + '"')
    const rmv = o.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    return rmv.mainMaterial.mainPass.baseColor as vec4
  }

  /** The step row object ("Step 1", "Step 2", ...) inside a device's step stack. */
  stepRow(id: string, stepNumber: number): SceneObject {
    const o = findSceneObjectByName("Step " + stepNumber, this.object("StepStack " + id))
    if (!o) throw new Error("Step " + stepNumber + " row not found for " + id)
    return o
  }

  stepHighlighted(id: string, stepNumber: number): boolean {
    return findSceneObjectByName("Step Highlight", this.stepRow(id, stepNumber)).enabled
  }

  stepText(id: string, stepNumber: number): string {
    return (findSceneObjectByName("Step Text", this.stepRow(id, stepNumber)).getComponent("Component.Text") as Text).text
  }
}
