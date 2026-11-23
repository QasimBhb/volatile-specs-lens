import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {FactsAndProblemsScenario} from "./FactsAndProblemsScenario"
import {GazeQuestionsScenario} from "./GazeQuestionsScenario"
import {RankingScenario} from "./RankingScenario"
import {ScenarioAndReassessScenario} from "./ScenarioAndReassessScenario"
import {SceneSecuredScenario2} from "./SceneSecuredScenario2"
import {StartAndScanScenario} from "./StartAndScanScenario"

/**
 * LEAF scenarios for Volatile, one per done criterion in devpost/design-brief.md.
 * Each one runs on a freshly reset preview and sets up the state it needs.
 */
@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "v2-1-start-and-scan", typename: StartAndScanScenario.getTypeName()},
    {id: "v2-2-gaze-questions", typename: GazeQuestionsScenario.getTypeName()},
    {id: "v2-3-ranking", typename: RankingScenario.getTypeName()},
    {id: "v2-4-facts-and-problems", typename: FactsAndProblemsScenario.getTypeName()},
    {id: "v2-5-scenario-and-reassess", typename: ScenarioAndReassessScenario.getTypeName()},
    {id: "v2-6-scene-secured", typename: SceneSecuredScenario2.getTypeName()}
  ]
}
