// The dreams' own words, in one place (PLAN-2.md 3.1), so the narrative can
// be reworked without touching any logic. All copy here is a draft.
//
// `lines` is each dream's log, sentence by sentence. A line is revealed by
// `at` (free dreams: 0; beats: the beat index; scrub: the progress 0-1), by
// `on` (a scene event, e.g. the whale's 'wave'), or by whichever of the two
// comes first. Lines are revealed in order.
// `glitches`: a word the transcript first mistypes as `wrong`, then fixes.
// `fragment`: what the DR-1 keeps if you do the dream's one intentional thing.
// `action`: the keyboard-reachable DreamAction's label. `hint`: the Hud prompt
// shown when the interaction isn't obvious (null: no prompt).
export const DREAMS = {
  stair: {
    lines: [
      { at: 0, text: 'You are climbing.' },
      { at: 0.33, text: 'You have been climbing for a long time.' },
      { at: 0.66, text: 'Every landing has the same window, and the same moon in it.' },
      { at: 1, text: 'If you stop, the stairs keep going.' }
    ],
    glitches: [{ word: 'moon', wrong: 'noon' }],
    fragment: { id: 'stair', label: "You stopped. The stairs didn't." },
    action: 'Stop climbing',
    hint: 'Hold to stop'
  },
  whale: {
    lines: [
      { at: 0, text: 'It swims slowly between the rooftops.' },
      { at: 0, text: 'Nobody looks up.' },
      { at: 0, text: 'You wave,' },
      { on: 'wave', text: 'and it turns one eye toward you.' }
    ],
    glitches: [{ word: 'eye', wrong: 'I' }],
    fragment: { id: 'whale', label: 'It looked back.' },
    action: 'Wave at the whale',
    hint: 'Wave ↔'
  },
  house: {
    lines: [
      { at: 0, text: 'The hallway is longer than it was.' },
      { at: 0, text: 'Every door opens onto the same kitchen, and someone is always just leaving it.' },
      { at: 0, text: 'You can smell toast.' },
      { at: 0, text: 'You never find out whose.' }
    ],
    glitches: [{ word: 'toast', wrong: 'ghost' }],
    fragment: { id: 'house', label: 'You never saw their face.' },
    action: 'Open a door',
    hint: 'Open a door'
  },
  ocean: {
    lines: [
      { at: 0, text: 'The water comes in under the door without a sound.' },
      { at: 1, text: "It's warm, and it keeps rising." },
      { at: 2, text: 'The furniture floats up politely.' },
      { at: 3, text: 'You were never afraid of this.' }
    ],
    glitches: [{ word: 'politely', wrong: 'quietly' }],
    fragment: { id: 'ocean', label: "You weren't afraid." },
    action: 'Stay under',
    hint: null
  },
  fall: {
    lines: [
      { at: 0, text: "There's no ground yet." },
      { at: 0.25, text: 'The clouds go past in the wrong direction.' },
      { at: 0.5, on: 'let-go', text: "You're not falling so much as being let go of." },
      { at: 0.75, text: 'Somewhere below, an alarm is starting.' }
    ],
    glitches: [{ word: 'clouds', wrong: 'crowds' }],
    fragment: { id: 'fall', label: 'You let go.' },
    action: 'Let go',
    hint: null
  }
};

// The five dreams in the order the night walks them.
export const DREAM_IDS = Object.keys(DREAMS);
