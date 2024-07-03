import { Payload } from './base.js';
import { generatePattern } from '../../../eight/src/examples/generatePattern.js';


export class PatternPlayer {
  constructor(threshold = 0, mode = 'drum') {
    this.threshold = threshold;
    this.mode = mode;
    this.regeneratePattern();
  }

  state = {
    lastPlayedP16: null,
    lastNote: null,
  }
  
  regeneratePattern() {
    this.pattern = generatePattern();
  }

  playPatternRaw(clock) {
    const p16 = Math.floor(clock / 96 * 16);
    if (p16 !== this.state.lastPlayedP16) {
      const idx = p16 % this.pattern.length;
      const value = this.pattern.values[idx];
      this.state.lastPlayedP16 = p16;
      return value > this.threshold ? value : null;
    }
    return null;
  }  
  
  playPatternToMidi(clock, outputPort) {
    const playRawResult = this.playPatternRaw(clock);
    if (playRawResult) {
      if (this.state.lastNote) {
        outputPort.send('noteoff', this.state.lastNote);  
      }
      let note;
      if (this.mode === 'drum') {
        note = {note: 64, velocity: 127 * playRawResult, channel: 2};
      } else if (this.mode === 'melodic') {
        note = {note: 48 + Math.floor(playRawResult * 6) * 4, velocity: 90, channel: 1};
      } else {
        throw new Error();
      }
      outputPort.send('noteon', note);
      this.state.lastNote = note;
    }
  }
}

export default class EightPayload extends Payload {
  __name = 'eight-dev';
  
  constructor(threshold = 0) {
    const inputMidiName = 'loopMIDI vavemap clock';
    const outputMidiName = 'loopMIDI vavemap';
    super(inputMidiName, outputMidiName);
    this.drumPlayer = new PatternPlayer(threshold, 'drum');
    this.melodicPlayer = new PatternPlayer(threshold, 'melodic');
  }

  state = {
    clock: 0,
  }
  
  regeneratePattern() {
    this.drumPlayer.regeneratePattern();
    this.melodicPlayer.regeneratePattern();
  }
  
  onInputMessage(originalMessage) {
    if (originalMessage._type !== 'clock') {
      console.log('not a clock!', originalMessage);
    }    
    if (originalMessage._type === 'start' ||
        originalMessage._type === 'stop' ||
        originalMessage._type === 'position') {
      this.state.clock = 0;
    } else if (originalMessage._type === 'clock') { 
      this.state.clock++;
      this.drumPlayer.playPatternToMidi(this.state.clock, this.outputPort);
      this.melodicPlayer.playPatternToMidi(this.state.clock, this.outputPort);
    }
  }


}