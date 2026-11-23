import { basicAttack, defineFighter, type RosterEntry } from './fighter-kit.js';
import { roster } from './roster.js';

const base = roster.find(entry => entry.fighter.id === 'whale')!;
const partner = roster.find(entry => entry.fighter.id === 'banana')!;

// Copy the shared straight punch for the test actions only. Zero push keeps both sides in range.
const probeAction = { ...basicAttack, advance: 0, push: 0, cancelOnHit: [], hitstun: 6 };
const testFighter = defineFighter({
  id: base.fighter.id, name: '音频联调体', art: base.art, height: base.height, accent: base.accent,
  audio: {
    start: { src: 'assets/audio/demo/probe-start.wav' },
    interrupt: { src: 'assets/audio/demo/probe-interrupt.wav', volume: .8 },
    continue: { src: 'assets/audio/demo/probe-continue.wav', volume: .8 },
    impact: { src: 'assets/audio/demo/probe-impact.wav' }
  },
  signatureMoves: [
    {
      ...probeAction, id: 'audio-interrupt-probe', name: '音效与语音轨联调', slot: 'B',
      startup: 36, active: 3, recovery: 69, damage: 36,
      audioTimeline: [
        { frame: 0, clip: 'start', channel: 'sfx' },
        { frame: 12, clip: 'interrupt', channel: 'voice', stopOnInterrupt: true }
      ],
      feedback: { audio: { clip: 'impact' } }
    },
    {
      ...probeAction, id: 'audio-continue-probe', name: '语音继续联调', slot: 'C',
      startup: 1, active: 1, recovery: 106, hitTimeline: [],
      audioTimeline: [{ frame: 0, clip: 'continue', channel: 'voice', stopOnInterrupt: false }]
    }
  ]
});

const sparringFighter = defineFighter({
  id: partner.fighter.id, name: '音频联调陪练', art: partner.art, height: partner.height,
  accent: partner.accent, signatureMoves: []
});
sparringFighter.fighter.actions = sparringFighter.fighter.actions.map(action => action.id === basicAttack.id
  ? { ...probeAction, startup: 30, damage: 25, hitstun: 9 }
  : action);

export const audioDemoRoster: [RosterEntry, RosterEntry] = [testFighter, sparringFighter];
