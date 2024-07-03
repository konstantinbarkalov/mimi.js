import { ClockedPayload } from './base.js';

class SmcTockableRawState {
  faders = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  encoders = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  ms = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  ss = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  rs = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  qs = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  applyUpdate(anotherState) {
    for (let idx = 0; idx < 7; idx++) {
      this.faders[idx] =  anotherState.faders[idx] === undefined ? this.faders[idx] : anotherState.faders[idx];
      this.encoders[idx] =  anotherState.encoders[idx] === undefined ? this.encoders[idx] : anotherState.encoders[idx];
      this.ms[idx] =  anotherState.ms[idx] === undefined ? this.ms[idx] : anotherState.ms[idx];
      this.ss[idx] =  anotherState.ss[idx] === undefined ? this.ss[idx] : anotherState.ss[idx];
      this.rs[idx] =  anotherState.rs[idx] === undefined ? this.rs[idx] : anotherState.rs[idx];
      this.qs[idx] =  anotherState.qs[idx] === undefined ? this.qs[idx] : anotherState.qs[idx];
    }
  }
}

class SmcFullRawState extends SmcTockableRawState{
  navs = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  play = undefined;
  pause = undefined;
  rec = undefined;
  applyUpdate(anotherState) {
    super.applyUpdate(anotherState);
    for (let idx = 0; idx < 7; idx++) {
      this.navs[idx] = anotherState.navs[idx] === undefined ? this.navs[idx] : anotherState.navs[idx];
    }
    this.play = anotherState.play === undefined ? this.play : anotherState.play;
    this.pause = anotherState.pause === undefined ? this.pause : anotherState.pause;
    this.rec = anotherState.rec === undefined ? this.rec : anotherState.rec;
  }
}

class ModuloOutputState {
  smartmods = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
}

export default class SmcModuloCatchedClockedPayload extends ClockedPayload {
  __name = 'smc-modulo-catched';
  constructor() {
    const inputMidiName = 'SMC-Mixer-Bt';
    const inputClockMidiName = 'loopMIDI vavemap clock';
    const outputMidiName = 'loopMIDI vavemap';
    super(inputMidiName, inputClockMidiName, outputMidiName);
  }
  ticksPerTock = 96 * 8;

  state = {
    deviceFullRawActual: new SmcFullRawState(),
    immediate: new SmcTockableRawState(),
    tock: new SmcTockableRawState(),
    output:  new ModuloOutputState(),
    clock: 0,
  };
  
  calculateSmartmod(idx) {
    const isSelfSolo = this.state.immediate.ss[idx];
    let isAnySolo = false;
    for (let idx2 = 0; idx2 < 8; idx2++) {
      isAnySolo = isAnySolo || this.state.immediate.ss[idx2];
      if (isAnySolo) { break; }
    }
    const isUnmuted = !isAnySolo || isSelfSolo;
    const fader = isUnmuted ? (this.state.immediate.faders[idx] || 0) : 0;
    const m = this.state.immediate.ms[idx] ? 1 : 0;
    // const s = deviceRawState.ss[idx] ? 1 : 0; // s not used in mask, TODO: used as all channel solo
    const r = this.state.immediate.rs[idx] ? 1 : 0;
    const q = this.state.immediate.qs[idx] ? 1 : 0;
    const level16 = Math.floor(fader / 8); // 0 to 15
    const val = m * 2 ** 6 + r * 2 ** 5 + q * 2 ** 4 + level16;
    return val;
  }

  updateSmartmods() {
    for (let idx = 0; idx < 8; idx++) {
      const oldValue = this.state.output.smartmods[idx];
      const newValue = this.calculateSmartmod(idx);
      this.state.output.smartmods[idx] = newValue;
      if (newValue !== oldValue) {
        const message = {
          _type: 'cc',
          channel: 14,
          controller: idx + 8,
          value: newValue
        };
        this.outputPort.send(message._type, message);
        //console.log(message);
      }
    }
  }

  processOriginalMessage(originalMessage) {
    if (originalMessage._type === 'cc' && originalMessage.channel === 14) {
      const fullRawStateUpdate = new SmcFullRawState();
      if (originalMessage.controller < 8) {
        fullRawStateUpdate.encoders[originalMessage.controller] = originalMessage.value;
      } else if (originalMessage.controller >= 8 && originalMessage.controller < 16) {
        fullRawStateUpdate.faders[originalMessage.controller - 8] = originalMessage.value;
      } else if (originalMessage.controller >= 16 && originalMessage.controller < 24) {
        fullRawStateUpdate.ms[originalMessage.controller - 16] = !!originalMessage.value;
      } else if (originalMessage.controller >= 24 && originalMessage.controller < 32) {
        fullRawStateUpdate.ss[originalMessage.controller - 24] = !!originalMessage.value;
      } else if (originalMessage.controller >= 32 && originalMessage.controller < 40) {
        fullRawStateUpdate.rs[originalMessage.controller - 32] = !!originalMessage.value;
      } else if (originalMessage.controller >= 40 && originalMessage.controller < 48) {
        fullRawStateUpdate.qs[originalMessage.controller - 40] = !!originalMessage.value;
      } else if (originalMessage.controller >= 48 && originalMessage.controller < 56) {
        fullRawStateUpdate.navs[originalMessage.controller - 48] = !!originalMessage.value;
      } else if (originalMessage.controller === 56) {
        fullRawStateUpdate.play = !!originalMessage.value;
      } else if (originalMessage.controller === 57) {
        fullRawStateUpdate.pause = !!originalMessage.value;
      } else if (originalMessage.controller === 58) {
        fullRawStateUpdate.rec = !!originalMessage.value;
      } else {
        console.warn('unrecognized / unprocessed message', originalMessage);
        return null;
      }
      return fullRawStateUpdate;
    } else {
      this.outputPort.send(originalMessage._type, originalMessage); // bypass
      //console.log('bypassed message', originalMessage);
      return null;
    }
  }

  getIsTockShiftPressed() {
    return !this.state.deviceFullRawActual.play;
  }


  onInputMessage(originalConrollerMessage) {
    const fullRawStateUpdate = this.processOriginalMessage(originalConrollerMessage);
    if (fullRawStateUpdate) {
      const wasTockShiftPressed = this.getIsTockShiftPressed();
      this.state.deviceFullRawActual.applyUpdate(fullRawStateUpdate);
      const isTockShiftPressed = this.getIsTockShiftPressed();
      if (isTockShiftPressed !== wasTockShiftPressed) {
        console.log('TOCKSHIFT:', isTockShiftPressed);
      }
      if (!isTockShiftPressed) {
        this.state.immediate.applyUpdate(fullRawStateUpdate);
        }
      this.state.tock.applyUpdate(fullRawStateUpdate);

      this.onImmediate();
    }
  }
  onInputClockMessage(originalClockMessage) {
    if (originalClockMessage._type !== 'clock') {
      console.log('not a clock!', originalClockMessage);
    }
    
    if (originalClockMessage._type === 'start' ||
        originalClockMessage._type === 'stop' ||
        originalClockMessage._type === 'position') {
      this.state.clock = 0;
      this.onReset(); 
    } else if (originalClockMessage._type === 'clock') { 
      this.state.clock++;
      if (this.state.clock % this.ticksPerTock === this.ticksPerTock - 1) {
        this.onTock();
      }
    }
  }

  onImmediate() {
    this.updateSmartmods();
    //console.log('IMMEDIATE');

  }

  onTock() {
    this.state.immediate.applyUpdate(this.state.tock);
    this.updateSmartmods();
    this.state.tock = new SmcTockableRawState();
    console.log('TOCK!', this.state.clock);
  }

  onReset() {
    this.state.immediate.applyUpdate(this.state.tock);
    this.updateSmartmods();
    this.state.tock = new SmcTockableRawState();
    console.log('RESET!', this.state.clock);
  }
}