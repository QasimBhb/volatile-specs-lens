import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {CustodyEntryScenario} from "./CustodyEntryScenario"
import {GazeDwellScenario} from "./GazeDwellScenario"
import {RankingScenario} from "./RankingScenario"
import {SceneSecuredScenario} from "./SceneSecuredScenario"
import {StartAndScanScenario} from "./StartAndScanScenario"
import {StartChipsScenario} from "./StartChipsScenario"
import {StepOrderScenario} from "./StepOrderScenario"

/**
 * LEAF scenarios for Volatile, one per done criterion in devpost/design-brief.md.
 * Run them in order on a freshly reset preview: they share the running Lens's state.
 */
@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "volatile-1-start-chips", typename: StartChipsScenario.getTypeName()},
    {id: "volatile-2-gaze-dwell-expands-laptop", typename: GazeDwellScenario.getTypeName()},
    {id: "volatile-3-done-completes-current-step-only", typename: StepOrderScenario.getTypeName()},
    {id: "volatile-4-custody-entry-per-done", typename: CustodyEntryScenario.getTypeName()},
    {id: "volatile-5-scene-secured-banner", typename: SceneSecuredScenario.getTypeName()},
    {id: "v2-1-start-and-scan", typename: StartAndScanScenario.getTypeName()},
    {id: "v2-3-ranking", typename: RankingScenario.getTypeName()}
  ]
}
