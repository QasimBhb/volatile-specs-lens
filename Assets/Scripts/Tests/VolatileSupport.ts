import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {VolatileView} from "../VolatileView"

export const LAPTOP = "LAP-01"
export const ROUTER = "NET-01"
export const PHONE = "PH-01"
export const USB = "USB-01"
export const DEVICE_IDS = [LAPTOP, ROUTER, PHONE, USB]

/**
 * Shared helpers for the Volatile LEAF scenarios.
 *
 * Every scenario starts on a freshly reset preview (the runner resets it), so each one sets up
 * the state it needs. Answers are given by pinching the real UI Kit buttons on the open card.
 * LEAF cannot turn the responder's head, so gaze is simulated; the Lens's own dwell timer,
 * ring, open and close logic still run.
 */
export class VolatileSupport {
  readonly view: VolatileView
  private interactor = new DefaultLeafInteractor()

  constructor() {
    const root = findSceneObjectByName("Volatile")
    if (!root) throw new Error('Scene object "Volatile" not found')
    this.view = root.getComponent(VolatileView.getTypeName()) as VolatileView
    if (!this.view) throw new Error("VolatileView not found on Volatile")
  }

  async waitUntil(condition: () => boolean, timeoutMs: number, what: string): Promise<void> {
    let waited = 0
    while (!condition()) {
      if (waited >= timeoutMs) throw new Error("Timed out after " + timeoutMs + " ms waiting for " + what)
      await sleep(50)
      waited += 50
    }
  }

  /** Wait for the Lens to finish initialising, with gaze parked on nothing. */
  async start(): Promise<void> {
    await this.waitUntil(() => this.view.isReady(), 5000, "the Lens to finish initialising")
    this.view.setSimulatedGaze("away")
    await this.waitUntil(() => this.view.getOpenCardId() === null, 5000, "any card opened by the preview camera to close")
  }

  /** Look at a device until its card has opened. */
  async lookAt(id: string): Promise<void> {
    this.view.setSimulatedGaze(id)
    await this.waitUntil(() => this.view.isCardOpen(id), 4000, id + " card to open after gaze dwell")
    await sleep(100)
  }

  /** Look at nothing until every card has collapsed back to its chip. */
  async lookAway(): Promise<void> {
    this.view.setSimulatedGaze("away")
    await this.waitUntil(() => this.view.getOpenCardId() === null, 5000, "the open card to collapse")
  }

  /** Give gaze back to the real camera. Call this in a finally block. */
  releaseGaze(): void {
    this.view.setSimulatedGaze(null)
  }

  /** Pinch a real, enabled UI Kit button by its scene object name. */
  async pinch(name: string): Promise<void> {
    const target = findInteractableByName(name, undefined, true)
    if (!target) throw new Error('Enabled interactable "' + name + '" not found')
    await this.interactor.trigger(target)
    await sleep(300)
  }

  /**
   * Pinch the answer button that carries this label on the device's open card. Works for
   * state questions, facts and closing facts alike.
   */
  async answer(id: string, label: string): Promise<void> {
    const buttons = this.view.getDrawn(id).buttons
    if (!buttons) throw new Error("No answer buttons showing for " + id)
    const index = buttons[0] === label ? 0 : buttons[1] === label ? 1 : -1
    if (index < 0) throw new Error(id + ' has no "' + label + '" button; showing "' + buttons[0] + '" and "' + buttons[1] + '"')
    await this.pinch((index === 0 ? "AnswerA " : "AnswerB ") + id)
  }

  /** Look at a device and answer one after another, by label. */
  async answerAll(id: string, labels: string[]): Promise<void> {
    await this.lookAt(id)
    for (const label of labels) await this.answer(id, label)
  }

  /** Assess the four devices in the order of the demo run: router, phone, laptop, USB drive. */
  async assessDemoRun(): Promise<void> {
    await this.answerAll(ROUTER, ["On"])
    await this.answerAll(PHONE, ["On", "Locked", "No"])
    await this.answerAll(LAPTOP, ["On", "Unlocked", "No"])
    await this.answerAll(USB, ["Plugged into a running machine"])
  }

  object(name: string): SceneObject {
    const o = findSceneObjectByName(name)
    if (!o) throw new Error('Scene object "' + name + '" not found')
    return o
  }
}
