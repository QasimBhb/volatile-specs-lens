import type {Rules, StepDef} from "./VolatileTypes"

const LAPTOP_UNLOCKED_PHOTO: StepDef = {
  id: "photo",
  text: "Photograph the screen with the date, time and time zone.",
  sources: ["NIJ 2008", "INTERPOL 2021"],
  fact: {
    stem: "Screen:",
    answers: [
      {label: "Normal"},
      {label: "Wiping", outcome: {kind: "switch", state: "laptop.wiping"}}
    ]
  }
}

const LAPTOP_UNLOCKED_LOOK: StepDef = {
  id: "look",
  text: "Look, don't touch: encryption, mounted drives, cloud or remote sessions.",
  sources: ["INTERPOL 2021"],
  fact: {
    stem: "Any visible:",
    answers: [{label: "Yes"}, {label: "No"}]
  }
}

const LAPTOP_UNLOCKED_CALL: StepDef = {
  id: "call",
  text: "Don't shut down. Call trained personnel.",
  sources: ["INTERPOL 2021"],
  fact: {
    stem: "Trained staff:",
    answers: [
      {label: "Coming"},
      {
        label: "None free",
        outcome: {
          kind: "problem",
          variants: [
            {
              when: {stepId: "look", answer: 0},
              corrective: "Keep it on. Keep trying to reach trained staff.",
              sources: ["INTERPOL 2021"]
            },
            {
              when: {stepId: "look", answer: 1},
              corrective: "Remove power at the device end, not the wall.",
              sources: ["NIJ 2008", "ACPO 2012"],
              contested:
                "NIJ 2008 and ACPO 2012: remove power. INTERPOL 2021: keep it on if an expert can come.",
              closingFact: {
                stem: "Power:",
                answers: [
                  {label: "Removed", outcome: {kind: "switch", state: "laptop.off"}},
                  {label: "Still on", outcome: {kind: "stay"}}
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

export const VOLATILE_RULES: Rules = {
  devices: [
    {id: "LAP-01", kind: "laptop", name: "Laptop"},
    {id: "NET-01", kind: "router", name: "Router"},
    {id: "PH-01", kind: "phone", name: "Phone"},
    {id: "USB-01", kind: "usb", name: "USB drive"}
  ],

  firstQuestion: {
    laptop: "laptop.power",
    router: "router.power",
    phone: "phone.power",
    usb: "usb.connection"
  },

  questions: {
    "laptop.power": {
      id: "laptop.power",
      stem: "Power:",
      answers: [
        {label: "On", next: {question: "laptop.lock"}},
        {label: "Off", next: {state: "laptop.off"}}
      ]
    },
    "laptop.lock": {
      id: "laptop.lock",
      stem: "Screen:",
      answers: [
        {label: "Locked", next: {question: "laptop.locked.wipe"}},
        {label: "Unlocked", next: {question: "laptop.unlocked.wipe"}}
      ]
    },
    "laptop.locked.wipe": {
      id: "laptop.locked.wipe",
      stem: "Being wiped?",
      answers: [
        {label: "Yes", next: {state: "laptop.wiping"}},
        {label: "No", next: {state: "laptop.on.locked"}}
      ]
    },
    "laptop.unlocked.wipe": {
      id: "laptop.unlocked.wipe",
      stem: "Being wiped?",
      answers: [
        {label: "Yes", next: {state: "laptop.wiping"}},
        {label: "No", next: {state: "laptop.on.unlocked"}}
      ]
    },
    "router.power": {
      id: "router.power",
      stem: "Power:",
      answers: [
        {label: "On", next: {state: "router.on"}},
        {label: "Off", next: {state: "router.off"}}
      ]
    },
    "phone.power": {
      id: "phone.power",
      stem: "Power:",
      answers: [
        {label: "On", next: {question: "phone.lock"}},
        {label: "Off", next: {state: "phone.off"}}
      ]
    },
    "phone.lock": {
      id: "phone.lock",
      stem: "Screen:",
      answers: [
        {label: "Locked", next: {question: "phone.locked.wipe"}},
        {label: "Unlocked", next: {question: "phone.unlocked.wipe"}}
      ]
    },
    "phone.locked.wipe": {
      id: "phone.locked.wipe",
      stem: "Being wiped?",
      answers: [
        {label: "Yes", next: {state: "phone.wiping"}},
        {label: "No", next: {state: "phone.on.locked"}}
      ]
    },
    "phone.unlocked.wipe": {
      id: "phone.unlocked.wipe",
      stem: "Being wiped?",
      answers: [
        {label: "Yes", next: {state: "phone.wiping"}},
        {label: "No", next: {state: "phone.on.unlocked"}}
      ]
    },
    "usb.connection": {
      id: "usb.connection",
      stem: "USB drive:",
      answers: [
        {label: "Plugged into a running machine", next: {state: "usb.plugged"}},
        {label: "Loose", next: {state: "usb.loose"}}
      ]
    }
  },

  states: {
    "laptop.on.unlocked": {
      id: "laptop.on.unlocked",
      kind: "laptop",
      label: "ON · UNLOCKED",
      logLabel: "on, unlocked, not wiping",
      shortLabel: "unlocked",
      tier: 2,
      reason: "on and unlocked, could lock",
      strip: {
        text: "DON'T SHUT DOWN. DON'T TYPE OR CLICK.",
        sources: ["NIJ 2008", "INTERPOL 2021"]
      },
      steps: {
        criminal: [
          LAPTOP_UNLOCKED_PHOTO,
          LAPTOP_UNLOCKED_LOOK,
          LAPTOP_UNLOCKED_CALL,
          {
            id: "network",
            text: "Network: a judgement call. Cutting it stops remote tampering but loses open connections. Ask trained staff.",
            sources: ["ACPO 2012"],
            contested: "ACPO 2012: weigh it. CISA 2023, for ransomware: isolate first.",
            fact: {
              stem: "Network:",
              answers: [{label: "Left on"}, {label: "Cut"}]
            },
            reopenOnScenarioSwitch: true
          }
        ],
        ransomware: [
          LAPTOP_UNLOCKED_PHOTO,
          {
            id: "network",
            text: "Isolate from the network now: unplug the network cable.",
            sources: ["CISA 2023"],
            fact: {
              stem: "Isolated:",
              answers: [
                {label: "Yes"},
                {
                  label: "Can't",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective:
                          "Ask IT to cut the network at the switch. Only if that's impossible, remove power at the device end.",
                        sources: ["CISA 2023"],
                        contested:
                          "CISA 2023: power down only if it can't be isolated. Volatile memory is lost.",
                        closingFact: {
                          stem: "Fallback:",
                          answers: [
                            {label: "Switch cut"},
                            {
                              label: "Power removed",
                              outcome: {kind: "switch", state: "laptop.off"}
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              ]
            },
            reopenOnScenarioSwitch: true
          },
          LAPTOP_UNLOCKED_LOOK,
          LAPTOP_UNLOCKED_CALL
        ]
      }
    },

    "laptop.on.locked": {
      id: "laptop.on.locked",
      kind: "laptop",
      label: "ON · LOCKED",
      logLabel: "on, locked, not wiping",
      shortLabel: "locked",
      tier: 3,
      reason: "locked but live, keep it powered",
      strip: {
        text: "DON'T SHUT DOWN OR RESTART. DON'T TYPE.",
        sources: ["NIJ 2008", "ACPO 2012"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph the screen with the date, time and time zone.",
            sources: ["ACPO 2012", "INTERPOL 2021"],
            fact: {
              stem: "Screen:",
              answers: [{label: "Lock screen"}, {label: "Other"}]
            }
          },
          {
            id: "password",
            text: "Ask the user for the password and write it down.",
            sources: ["ACPO 2012"],
            fact: {
              stem: "Password:",
              answers: [{label: "Given"}, {label: "Not given"}]
            }
          },
          {
            id: "call",
            text: "Call trained personnel.",
            sources: ["INTERPOL 2021"],
            fact: {
              stem: "Trained staff:",
              answers: [
                {label: "Coming"},
                {
                  label: "None free",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Keep it on and powered. Keep trying to reach trained staff.",
                        sources: ["INTERPOL 2021"],
                        contested:
                          "NIJ 2008 and ACPO 2012 would remove power if no encryption is suspected."
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },

    "laptop.off": {
      id: "laptop.off",
      kind: "laptop",
      label: "OFF",
      logLabel: "off",
      shortLabel: "off",
      tier: 5,
      reason: "stable, can wait",
      strip: {
        text: "DON'T SWITCH IT ON.",
        sources: ["NIJ 2008", "ACPO 2012"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph it and its cables.",
            sources: ["NIJ 2008", "ACPO 2012"],
            fact: {
              stem: "Lid:",
              answers: [{label: "Open"}, {label: "Closed"}]
            }
          },
          {
            id: "unplug",
            text: "Label cables and ports, then unplug at the device end, not the wall.",
            sources: ["NIJ 2008", "ACPO 2012"],
            fact: {
              stem: "Unplugged:",
              answers: [{label: "At device"}, {label: "No cable"}]
            }
          },
          {
            id: "serial",
            text: "Record make, model and serial.",
            sources: ["NIJ 2008", "ACPO 2012"],
            fact: {
              stem: "Serial:",
              answers: [{label: "Recorded"}, {label: "Unreadable"}]
            }
          }
        ]
      }
    },

    "laptop.wiping": {
      id: "laptop.wiping",
      kind: "laptop",
      label: "BEING WIPED",
      logLabel: "being wiped",
      shortLabel: "wiping",
      tier: 1,
      reason: "wiping now, act first",
      strip: {
        text: "ACT NOW.",
        sources: ["NIJ 2008", "INTERPOL 2021"]
      },
      steps: {
        criminal: [
          {
            id: "power",
            text: "Pull power at the device end now.",
            sources: ["NIJ 2008", "INTERPOL 2021"],
            fact: {
              stem: "Power:",
              answers: [
                {label: "Pulled"},
                {
                  label: "Still on",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Remove the battery if you can. Call trained staff now.",
                        sources: ["NIJ 2008", "INTERPOL 2021"]
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "photo",
            text: "Photograph the screen and cabling as left.",
            sources: ["NIJ 2008"],
            fact: {
              stem: "Screen:",
              answers: [{label: "Dark"}, {label: "Still lit"}]
            }
          },
          {
            id: "call",
            text: "Call trained personnel.",
            sources: ["INTERPOL 2021"],
            fact: {
              stem: "Trained staff:",
              answers: [
                {label: "Coming"},
                {
                  label: "None free",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Keep trying to reach trained staff.",
                        sources: ["INTERPOL 2021"]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },

    "router.on": {
      id: "router.on",
      kind: "router",
      label: "ON",
      logLabel: "on",
      shortLabel: "on",
      tier: 4,
      reason: "leave on, call an expert",
      strip: {
        text: "DON'T LOG IN.",
        sources: ["ACPO 2012"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph the status lights and cabling.",
            sources: ["Inferred"],
            fact: {
              stem: "Lights:",
              answers: [{label: "Blinking"}, {label: "Steady"}]
            }
          },
          {
            id: "label",
            text: "Record make, model and visible network names.",
            sources: ["NIJ 2008"],
            fact: {
              stem: "Label:",
              answers: [{label: "Recorded"}, {label: "Unreadable"}]
            }
          },
          {
            id: "expert",
            text: "Leave it powered on and flag it for an expert.",
            sources: ["Inferred"],
            fact: {
              stem: "Expert:",
              answers: [
                {label: "Flagged"},
                {
                  label: "Not yet",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Flag it before you leave the room.",
                        sources: ["Inferred"]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },

    "router.off": {
      id: "router.off",
      kind: "router",
      label: "OFF",
      logLabel: "off",
      shortLabel: "off",
      tier: 5,
      reason: "stable, can wait",
      strip: {
        text: "DON'T SWITCH IT ON.",
        sources: ["Inferred"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph it and its cabling.",
            sources: ["Inferred"],
            fact: {
              stem: "Cables:",
              answers: [{label: "Connected"}, {label: "Loose"}]
            }
          },
          {
            id: "label",
            text: "Record make and model.",
            sources: ["Inferred"],
            fact: {
              stem: "Label:",
              answers: [{label: "Recorded"}, {label: "Unreadable"}]
            }
          },
          {
            id: "expert",
            text: "Flag it for an expert.",
            sources: ["Inferred"],
            fact: {
              stem: "Expert:",
              answers: [
                {label: "Flagged"},
                {
                  label: "Not yet",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Flag it before you leave the room.",
                        sources: ["Inferred"]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },

    "phone.on.unlocked": {
      id: "phone.on.unlocked",
      kind: "phone",
      label: "ON · UNLOCKED",
      logLabel: "on, unlocked, not wiping",
      shortLabel: "unlocked",
      tier: 2,
      reason: "on and unlocked, could lock",
      strip: {
        text: "DON'T LET IT LOCK.",
        sources: ["SWGDE 2025"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph the screen.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Screen:",
              answers: [
                {label: "Unlocked"},
                {
                  label: "Locked",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "It has locked. Pinch Reassess.",
                        sources: ["SWGDE 2025"]
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "power",
            text: "Keep the screen awake and connect power.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Power:",
              answers: [{label: "Connected"}, {label: "No charger"}]
            }
          },
          {
            id: "radios",
            text: "Check the radios. Airplane mode alone may leave Bluetooth and Wi-Fi on.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Radios:",
              answers: [
                {label: "All off"},
                {
                  label: "Still on",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Shield the phone now.",
                        sources: ["SWGDE 2025"],
                        closingFact: {
                          stem: "Shielded:",
                          answers: [
                            {label: "Yes"},
                            {label: "Not yet", outcome: {kind: "stay"}}
                          ]
                        }
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "bag",
            text: "Faraday bag: power bank inside, no cable crossing the shield.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Signal in bag:",
              answers: [
                {label: "None"},
                {
                  label: "Still showing",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Reseal or change the bag.",
                        sources: ["SWGDE 2025"]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },

    "phone.on.locked": {
      id: "phone.on.locked",
      kind: "phone",
      label: "ON · LOCKED",
      logLabel: "on, locked, not wiping",
      shortLabel: "locked",
      tier: 3,
      reason: "locked, could reboot or be wiped",
      strip: {
        text: "DON'T GUESS THE PASSCODE.",
        sources: ["SWGDE 2025"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph the screen.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Screen:",
              answers: [{label: "Lock screen"}, {label: "Notifications"}]
            }
          },
          {
            id: "power",
            text: "Connect power so it doesn't reboot.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Power:",
              answers: [{label: "Connected"}, {label: "No charger"}]
            }
          },
          {
            id: "bag",
            text: "Faraday bag: power bank inside, no cable crossing the shield.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Signal in bag:",
              answers: [
                {label: "None"},
                {
                  label: "Still showing",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Reseal or change the bag.",
                        sources: ["SWGDE 2025"]
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "handover",
            text: "Move it to acquisition now.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Handover:",
              answers: [
                {label: "Done"},
                {
                  label: "Waiting",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Keep it powered and shielded until handover.",
                        sources: ["SWGDE 2025"]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      },
      clock: {
        label: "Locked for at least",
        note: "vendor-reported, iPhone only: USB data may lock after about 1 hour locked, reboot to full encryption after about 72 hours"
      }
    },

    "phone.off": {
      id: "phone.off",
      kind: "phone",
      label: "OFF",
      logLabel: "off",
      shortLabel: "off",
      tier: 5,
      reason: "stable, can wait",
      strip: {
        text: "DON'T POWER ON. DON'T CHARGE.",
        sources: ["SWGDE 2025"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph it.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "Condition:",
              answers: [{label: "Intact"}, {label: "Damaged"}]
            }
          },
          {
            id: "ids",
            text: "Record the model and visible identifiers.",
            sources: ["SWGDE 2025"],
            fact: {
              stem: "IDs:",
              answers: [{label: "Recorded"}, {label: "Not visible"}]
            }
          },
          {
            id: "bag",
            text: "Bag it. Leave the SIM and card in.",
            sources: ["SWGDE 2025", "INTERPOL 2021"],
            fact: {
              stem: "Bagged:",
              answers: [{label: "Yes"}, {label: "No bag"}]
            }
          }
        ]
      }
    },

    "phone.wiping": {
      id: "phone.wiping",
      kind: "phone",
      label: "BEING WIPED",
      logLabel: "being wiped",
      shortLabel: "wiping",
      tier: 1,
      reason: "wiping now, act first",
      strip: {
        text: "ACT NOW.",
        sources: ["Inferred"]
      },
      steps: {
        criminal: [
          {
            id: "shield",
            text: "Shield it now: Faraday bag.",
            sources: ["Inferred"],
            fact: {
              stem: "Signal in bag:",
              answers: [
                {label: "None"},
                {
                  label: "Still showing",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Reseal or change the bag.",
                        sources: ["Inferred"]
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "call",
            text: "Call trained personnel.",
            sources: ["Inferred"],
            fact: {
              stem: "Trained staff:",
              answers: [
                {label: "Coming"},
                {
                  label: "None free",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Keep trying to reach trained staff.",
                        sources: ["Inferred"]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },

    "usb.plugged": {
      id: "usb.plugged",
      kind: "usb",
      label: "PLUGGED IN",
      logLabel: "plugged into a running machine",
      shortLabel: "plugged in",
      tier: 5,
      reason: "stable, can wait",
      strip: {
        text: "DON'T PULL IT OUT YET.",
        sources: ["Inferred"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph it in place.",
            sources: ["NIJ 2008"],
            fact: {
              stem: "Light:",
              answers: [{label: "Blinking"}, {label: "Off"}]
            }
          },
          {
            id: "label",
            text: "Label the drive and the port it's in.",
            sources: ["NIJ 2008", "INTERPOL 2021"],
            fact: {
              stem: "Labelled:",
              answers: [
                {label: "Both"},
                {
                  label: "Drive only",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Label the port too.",
                        sources: ["NIJ 2008", "INTERPOL 2021"]
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "wait",
            text: "Wait for the laptop's live-capture decision.",
            sources: ["Inferred"],
            fact: {
              stem: "Laptop decision:",
              answers: [
                {label: "Made"},
                {
                  label: "Not yet",
                  outcome: {
                    kind: "problem",
                    variants: [
                      {
                        corrective: "Leave it in. Come back after the laptop.",
                        sources: ["Inferred"]
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: "bag",
            text: "When trained staff say so: remove it and bag it in anti-static packaging.",
            sources: ["INTERPOL 2021"],
            fact: {
              stem: "USB:",
              answers: [{label: "Bagged"}, {label: "Left for staff"}]
            }
          }
        ]
      }
    },

    "usb.loose": {
      id: "usb.loose",
      kind: "usb",
      label: "LOOSE",
      logLabel: "loose",
      shortLabel: "loose",
      tier: 5,
      reason: "stable, can wait",
      strip: {
        text: "DON'T PLUG IT IN TO CHECK.",
        sources: ["INTERPOL 2021"]
      },
      steps: {
        criminal: [
          {
            id: "photo",
            text: "Photograph it in place.",
            sources: ["NIJ 2008"],
            fact: {
              stem: "Near a machine:",
              answers: [{label: "Yes"}, {label: "No"}]
            }
          },
          {
            id: "label",
            text: "Label it.",
            sources: ["NIJ 2008", "INTERPOL 2021"],
            fact: {
              stem: "Labelled:",
              answers: [{label: "Yes"}, {label: "No labels"}]
            }
          },
          {
            id: "bag",
            text: "Bag it in anti-static packaging.",
            sources: ["INTERPOL 2021"],
            fact: {
              stem: "Bag:",
              answers: [{label: "Anti-static"}, {label: "Other bag"}]
            }
          }
        ]
      }
    }
  },

  text: {
    scanPrompt: "Scan the room, trace the cables",
    scanButton: "I've scanned",
    scanLogged: "Room scanned, cables traced",
    sceneSecured: "Scene secured",
    scenarioLabels: {
      criminal: "Criminal seizure",
      ransomware: "Ransomware response"
    },
    logAssessed: "Assessed: {state}",
    logReassessed: "Reassessed: {from} to {to}",
    logScenario: "Scenario: {scenario}",
    nudge: "#{rank} {name} is still waiting"
  }
}
