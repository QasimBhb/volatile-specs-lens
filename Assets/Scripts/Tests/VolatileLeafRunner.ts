import {DefaultScenarioManager} from "Leaf.lspkg/Scenarios/scenario/manager/DefaultLeafScenarioManager"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

/**
 * Runs one LEAF scenario when the preview starts, and prints the result to the Logger.
 * Used when the LEAF panel is not available. Leave Scenario Id empty for normal use:
 * the runner then does nothing.
 */
@component
export class VolatileLeafRunner extends BaseScriptComponent {
  @input
  @hint("ID of the LEAF scenario to run on start (see LeafIndex). Empty = run nothing.")
  scenarioId: string = ""

  onAwake(): void {
    if (!this.scenarioId) return
    this.createEvent("OnStartEvent").bind(() => {
      this.runScenario()
        .then(() => print("[LEAF-RUN] PASSED " + this.scenarioId))
        .catch((error) => print("[LEAF-RUN] FAILED " + this.scenarioId + " :: " + error))
    })
  }

  private async runScenario(): Promise<void> {
    await sleep(1000)
    await DefaultScenarioManager.getInstance().startScenario(this.scenarioId)
  }
}
