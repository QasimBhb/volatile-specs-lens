/**
 * Volatile — device and step definitions (order of volatility).
 * All offsets are in cm, local to the stand-in device's root (origin on the desk top,
 * +X right, +Y up, +Z toward the user).
 */

export type StepDef = {
  /** What the responder does, as shown in the step stack. */
  label: string
  /** Past-tense action written to the custody log. */
  logged: string
}

export type DeviceDef = {
  id: string
  name: string
  rank: number
  /** Two-part headline shown on the full tag. */
  headline: string
  tagColor: vec4
  steps: StepDef[]
  /** Where the small rank chip floats. */
  chipOffset: vec3
  /** Centre of the full tag. */
  tagOffset: vec3
  tagWidth: number
  tagHeight: number
  /** Split the headline over two lines (small devices). */
  tagTwoLines: boolean
  /** Top-centre of the step stack. */
  stackOffset: vec3
  /** Centre and radius of the gaze target / scan ring. */
  gazeCenter: vec3
  gazeRadius: number
}

export const STACK_WIDTH = 24

export const DEVICES: DeviceDef[] = [
  {
    id: "LAP-01",
    name: "Laptop",
    rank: 1,
    headline: "#1 MOST VOLATILE: DON'T POWER OFF",
    tagColor: new vec4(0.95, 0.16, 0.14, 1),
    steps: [
      {label: "Photograph screen", logged: "screen photographed"},
      {label: "Capture RAM", logged: "RAM captured"},
      {label: "Note open sessions and network connections", logged: "open sessions and network connections noted"},
      {label: "Isolate from network", logged: "isolated from network"}
    ],
    chipOffset: new vec3(0, 26, -16.5),
    tagOffset: new vec3(0, 26.5, -16.5),
    tagWidth: 33,
    tagHeight: 4.6,
    tagTwoLines: false,
    // Right side of the lid (the Log chip takes the front-left corner of the desk).
    stackOffset: new vec3(16.5 + 2 + STACK_WIDTH / 2, 25, -14),
    gazeCenter: new vec3(0, 11, -8),
    gazeRadius: 21
  },
  {
    id: "NET-01",
    name: "Router",
    rank: 2,
    headline: "#2 NETWORK STATE: LEAVE POWERED ON",
    tagColor: new vec4(1.0, 0.45, 0.1, 1),
    steps: [
      {label: "Photograph status lights and cabling", logged: "status lights and cabling photographed"},
      {label: "Export connection table", logged: "connection table exported"},
      {label: "Leave powered on", logged: "left powered on"}
    ],
    chipOffset: new vec3(0, 7.5, 3),
    tagOffset: new vec3(0, 18.5, -5),
    tagWidth: 20,
    tagHeight: 5.4,
    tagTwoLines: true,
    // Left of the router: its right side is the end of the desk.
    stackOffset: new vec3(-(9 + 2 + STACK_WIDTH / 2), 24, 0),
    gazeCenter: new vec3(0, 6, 0),
    gazeRadius: 13
  },
  {
    id: "PH-01",
    name: "Phone",
    rank: 3,
    headline: "#3 LIVE SESSION: DON'T LET IT LOCK",
    tagColor: new vec4(1.0, 0.7, 0.1, 1),
    steps: [
      {label: "Photograph screen", logged: "screen photographed"},
      {label: "Airplane mode", logged: "airplane mode enabled"},
      {label: "Faraday bag", logged: "placed in Faraday bag"}
    ],
    chipOffset: new vec3(0, 4, 0),
    tagOffset: new vec3(0, 10, -8),
    tagWidth: 20,
    tagHeight: 5.4,
    tagTwoLines: true,
    // Right of the phone, set back so the USB drive stays visible in front of it.
    stackOffset: new vec3(3.75 + 3 + STACK_WIDTH / 2, 22, -9),
    gazeCenter: new vec3(0, 2, 0),
    gazeRadius: 10
  },
  {
    id: "USB-01",
    name: "USB drive",
    rank: 4,
    headline: "#4 LEAST VOLATILE: BAG LAST",
    tagColor: new vec4(0.35, 0.65, 1.0, 1),
    steps: [
      {label: "Photograph in place", logged: "photographed in place"},
      {label: "Bag and label", logged: "bagged and labeled"}
    ],
    chipOffset: new vec3(0, 3.5, 0),
    tagOffset: new vec3(0, 9, -6),
    tagWidth: 18,
    tagHeight: 5.4,
    tagTwoLines: true,
    stackOffset: new vec3(1 + 3 + STACK_WIDTH / 2, 19, -8),
    gazeCenter: new vec3(0, 1.5, 0),
    gazeRadius: 8
  }
]
