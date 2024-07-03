#!/usr/bin/env node
import { program } from 'commander';
import { payloads } from './payloads.js';

async function start(key) {
  const Payload = payloads[key];
  if (Payload) {
    const payload = new Payload();
    console.log(`payload "${payload.__name}" (key: ${key}) is started`);
  } else {
    throw new Error('unknown payload');
  }
};

async function list() {
  console.log(`List of all aviable payload keys:`);
  Object.keys(payloads).forEach((payloadKey, idx) => {
    console.log(`${idx+1}: ${payloadKey}`);  
  });
};

program
  .version('0.0.0')
  .command('start')
  .description('Start payload (you propably looking this command)')
  .requiredOption('-n, --payload-name <name>', 'Payload name')
  .action(async (options) => {
    await start(options.payloadName);
  });
program
  .command('list')
  .description('Show list of all aviable payloads')
  .action(async (options) => {
    await list();
  });
program.parse(process.argv);


