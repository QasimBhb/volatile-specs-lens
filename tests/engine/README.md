# Engine tests

Node tests for the rules data and the engine in `Assets/Scripts/` (`VolatileRules.ts`,
`VolatileEngine.ts`). Both files are plain TypeScript with no Lens Studio code, so they run
outside Lens Studio. Nothing needs installing. Node 26 or later.

From the repository root:

```sh
node tests/engine/run.ts
```

`register-ts.ts` lets Node resolve the extensionless imports that Lens Studio expects.

The Lens itself is tested in Lens Studio's preview with the LEAF scenarios in
`Assets/Scripts/Tests/`, one per done criterion in `devpost/design-brief.md`.
