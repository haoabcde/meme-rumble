import { createMatch, step } from './match.js';
import { MAX_ENERGY, MAX_TEARS, MAX_WHALE_MANA, TEAR_UNITS_PER_POINT } from './types.js';
import type { CombatEvent, Duo, FighterDefinition, FighterState, InputFrame, MatchConfig, MatchState, RoundResult } from './types.js';

type RosterIndex = 0 | 1;

/** Two ordered teams. Each team fields its lead fighter before its reserve. */
export type RelayRoster = Duo<Duo<FighterDefinition>>;

export interface RelayBoutRecord {
  fighters: Duo<string>;
  indices: Duo<RosterIndex>;
  result: RoundResult;
}

export interface RelaySession {
  teams: RelayRoster;
  /** Active roster slots. The final pair remains available for the results screen. */
  indices: Duo<RosterIndex>;
  eliminated: Duo<number>;
  /** Increments when config and state are replaced for a new pair. */
  generation: number;
  history: RelayBoutRecord[];
  config: MatchConfig;
  state: MatchState;
  phase: 'playing' | 'finished';
  /** Team winner. A null winner in the finished phase is a team draw. */
  winner: 0 | 1 | null;
}

function isValidTeam(team: Duo<FighterDefinition>) {
  return Array.isArray(team) && team.length === 2 &&
    typeof team[0]?.id === 'string' && typeof team[1]?.id === 'string' &&
    team[0].id !== team[1].id;
}

export function createRelayMatch(baseConfig: MatchConfig, teams: RelayRoster): RelaySession {
  if (baseConfig.training) throw new Error('Relay matches do not support training.');
  if (!Array.isArray(teams) || teams.length !== 2 || !isValidTeam(teams[0]) || !isValidTeam(teams[1])) {
    throw new Error('Relay matches require two distinct fighters on each team.');
  }
  const config: MatchConfig = {
    ...baseConfig,
    rules: { ...baseConfig.rules, winsToFinish: 1, drawsToFinish: 1 },
    fighters: [teams[0][0], teams[1][0]]
  };

  return {
    teams: [[...teams[0]], [...teams[1]]],
    indices: [0, 0],
    eliminated: [0, 0],
    generation: 0,
    history: [],
    config,
    state: createMatch(config),
    phase: 'playing',
    winner: null
  };
}

function clamp(value: number, max: number) {
  return Math.min(Math.max(0, value), max);
}

function carryResources(previous: FighterState, next: FighterState) {
  next.hp = clamp(previous.hp, next.hp);
  next.energy = clamp(previous.energy, MAX_ENERGY);
  if (next.whaleMana !== undefined && previous.whaleMana !== undefined) next.whaleMana = clamp(previous.whaleMana, MAX_WHALE_MANA);
  if (next.tearUnits !== undefined && previous.tearUnits !== undefined) {
    next.tearUnits = clamp(previous.tearUnits, MAX_TEARS * TEAR_UNITS_PER_POINT);
  }
}

/**
 * A KO or timeout eliminates the losing fighter. A double KO or tie eliminates both.
 * Complete the bout's presentation before swapping fighters. Returned events always
 * belong to the bout that was active when the step began.
 */
export function stepRelayMatch(session: RelaySession, inputs: Duo<InputFrame>): CombatEvent[] {
  if (session.phase === 'finished') return [];
  const { state, config, teams, indices, eliminated } = session;
  const events = step(state, inputs, config);
  const result = state.result;
  if (state.phase !== 'match-over' || !result) return events;

  session.history.push({
    fighters: [config.fighters[0].id, config.fighters[1].id],
    indices: [...indices],
    result: { ...result }
  });
  if (result.winner !== 0) eliminated[0]++;
  if (result.winner !== 1) eliminated[1]++;
  const leftExhausted = eliminated[0] === teams[0].length;
  const rightExhausted = eliminated[1] === teams[1].length;
  if (leftExhausted || rightExhausted) {
    session.phase = 'finished';
    session.winner = leftExhausted === rightExhausted ? null : leftExhausted ? 1 : 0;
    return events;
  }

  const nextIndices: Duo<RosterIndex> = [eliminated[0] ? 1 : 0, eliminated[1] ? 1 : 0];
  const nextConfig: MatchConfig = {
    ...config,
    fighters: [teams[0][nextIndices[0]], teams[1][nextIndices[1]]]
  };
  // A fresh bout resets both spawns and every transient, leaving only the winner's resources to carry.
  const nextState = createMatch(nextConfig);
  if (result.winner !== null) {
    carryResources(state.fighters[result.winner], nextState.fighters[result.winner]);
  }
  session.indices = nextIndices;
  session.config = nextConfig;
  session.state = nextState;
  session.generation++;
  return events;
}
