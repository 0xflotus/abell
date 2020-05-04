#!/usr/bin/env node

const action = require('./action');
const program = require('commander');

const { getBaseProgramInfo } = require('./content-generator');

program.version(require('../package.json').version);

program
  .command('build')
  .action(async () => {
    const programInfo = await getBaseProgramInfo();
    programInfo.logs = 'complete';
    programInfo.task = 'build';
    await action.build(programInfo);
  });

program
  .command('serve')
  .option('--port [port]', 'Serve on different port')
  .action(async (command) => {
    const programInfo = await getBaseProgramInfo();
    programInfo.port = command.port || 5000;
    programInfo.task = 'serve';
    programInfo.logs = 'minimum';
    programInfo.abellConfigs.destinationPath = '.debug';
    
    await action.serve(programInfo);
  })

program.parse(process.argv);

module.exports = action;