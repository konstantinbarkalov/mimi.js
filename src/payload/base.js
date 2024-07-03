import easymidi from 'easymidi';
export class Payload {
  __name = 'base (as is)';
  
  constructor(inputMidiName, outputMidiName) {
    this.inputPort = new easymidi.Input(inputMidiName);
    this.outputPort = new easymidi.Output(outputMidiName);

    this.inputPort.on('message', (originalMessage) => {
      try {
        this.stats.inputMessagesReceived++;
        this.onInputMessage(originalMessage);
      } catch (error) {
        console.error(error);
      }
    });  
  }

  onInputMessage(originalMessage) {
    this.outputPort.send(originalMessage._type, originalMessage);
  }
  
  stats = {
    inputMessagesReceived: 0,
  };
  
}

export class ClockedPayload extends Payload {
  __name = 'clocked base (as is)';
  
  constructor(inputMidiName, inputClockMidiName, outputMidiName) {
    super(inputMidiName, outputMidiName);
    this.inputClockPort = new easymidi.Input(inputClockMidiName);

    this.inputClockPort.on('message', (originalMessage) => {
      try {
        this.stats.clockMessagesReceived++;
        this.onInputClockMessage(originalMessage);
      } catch (error) {
        console.error(error);
      }
    });  
  }


  onInputClockMessage(originalClockMessage) {
    // do nothing
  }

  stats = {
    inputMessagesReceived: 0,
    clockMessagesReceived: 0,
  };
  
}