import { State } from './types';

class StateManager {
  private state: State;

  constructor(initialState: State) {
    this.state = initialState;
  }

  getState(): State {
    return this.state;
  }

  updateState(newState: Partial<State>): void {
    this.state = { ...this.state, ...newState };
  }
}

export default StateManager;
