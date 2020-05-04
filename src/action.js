const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);

const browserSync = require('browser-sync');
const chokidar = require('chokidar');

const { 
  getDirectories,
  rmdirRecursiveSync,
  copyFolderSync,
  exitHandler,
  boldGreen
} = require('./helpers.js');

const { 
  generateContentFile, 
  generateHTMLFile,
  getBaseProgramInfo,
  getContentMeta
} = require('./content-generator');



/**
 * @method build
 * @param {any} programInfo programInfo has all the information required by program for build
 * @description
 *  Builds the static site! 
 *  The build parameters are first calculated in index.js and the programInfo with all those parameters is passed
 */

async function build(programInfo) {

  if(programInfo.logs == 'complete') console.log("\n>> Abell Build Started\n");

  const contentDirectories = getDirectories(programInfo.abellConfigs.contentPath);

  // Refresh dist
  rmdirRecursiveSync(programInfo.abellConfigs.destinationPath);
  fs.mkdirSync(programInfo.abellConfigs.destinationPath);
  
  // Copy everything from src to dist except [content] folder and index.abell.
  copyFolderSync(programInfo.abellConfigs.sourcePath, programInfo.abellConfigs.destinationPath);
  rmdirRecursiveSync(path.join(programInfo.abellConfigs.destinationPath, '[content]'));
  fs.unlinkSync(path.join(programInfo.abellConfigs.destinationPath, 'index.abell'))


  // GENERATE CONTENT HTML FILES 
  for(let contentSlug of contentDirectories) {
    await generateContentFile(contentSlug, programInfo);
    if(programInfo.logs == 'complete') console.log(`...Built ${contentSlug}`);
  }

  // GENERATE OTHER HTML FILES
  await generateHTMLFile('index', programInfo);
  if(programInfo.logs == 'complete') console.log(`...Built index\n`);

  if(programInfo.logs == 'complete') {
    console.log(`${boldGreen('>>>')} Build complete 🚀✨`);
    const compileTime = new Date().getTime() - programInfo.compileStartTime
    console.log(`🕑  Built in ${compileTime}ms\n\n`);
  }
  if(programInfo.logs == 'minimum') console.log(`${boldGreen('>>>')} Files built.. ✨`);

}



async function serve(programInfo) {  
  
  await build(programInfo);

  console.log("Starting your abell-dev-server 🤠...")
  const bs = browserSync.create('abell-dev-server');
  
  bs.init({
    port: programInfo.port,
    server: programInfo.abellConfigs.destinationPath,
    logLevel: 'silent',
    logPrefix: 'abell-dev-server',
    logConnections: false,
    notify: false,
    reloadDelay: 1000
  });


  // Print ports on screen
  console.log('='.repeat(process.stdout.columns));
  console.log("\n\n💫 Abell dev server running.");
  console.log(`${boldGreen("Local: ")} http://localhost:${programInfo.port} \n\n`);
  console.log('='.repeat(process.stdout.columns));


  const abellConfigsPath = path.join(process.cwd(), 'abell.config.js')
  if(fs.existsSync(abellConfigsPath)) {
    // Watch abell.config.js
    chokidar
      .watch(abellConfigsPath, {ignoreInitial: true})
      .on('change', async filePath => {

        // delete require.cache[abellConfigsPath];

        const baseProgramInfo = await getBaseProgramInfo();
        // destination should be unchanged while serving. So we keep existing destination in temp variable.
        const existingDestination = programInfo.abellConfigs.destinationPath;
        programInfo.abellConfigs = baseProgramInfo.abellConfigs;
        programInfo.abellConfigs.destinationPath = existingDestination;
        programInfo.globalMeta = baseProgramInfo.globalMeta;

        console.log("Abell configs changed 🤓");

        await build(programInfo);
        bs.reload();
      })
  }


  // Watch 'src'
  chokidar
    .watch(programInfo.abellConfigs.sourcePath, {ignoreInitial: true})
    .on('all', async (event, filePath) => {
      const directoryName = filePath.slice(programInfo.abellConfigs.sourcePath.length + 1).split('/')[0];
      if(filePath.endsWith('index' + programInfo.templateExtension) && directoryName === '[content]') {
        // Content template changed
        programInfo.contentTemplate = await readFile(path.join(programInfo.abellConfigs.sourcePath, '[content]', 'index' + programInfo.templateExtension), 'utf-8');
      }
        
      await build(programInfo);
      bs.reload();
    })


  // Watch 'content'
  chokidar
    .watch(programInfo.abellConfigs.contentPath, {ignoreInitial: true})
    .on('all', async (event, filePath) => {
      try{
        const directoryName = filePath.slice(programInfo.abellConfigs.contentPath.length + 1).split('/')[0];
        if(filePath.endsWith('index.md')) {
          await generateContentFile(directoryName, programInfo);
          console.log(`...Built ${directoryName}`);
        }else if(filePath.endsWith('meta.json')) {
          // refetch meta and then build
          const meta = await getContentMeta(directoryName, programInfo.abellConfigs.contentPath);
          programInfo.globalMeta.contentMetaInfo[directoryName] = meta;
          await build(programInfo);
        }else {
          await build(programInfo);
        }
        
      }catch(err) {
        await build(programInfo);
      }

      bs.reload();
    })


  // do something when app is closing
  process.on('exit', exitHandler.bind(null,{cleanup:true}));
  //catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, {exit:true}));
  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
  process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
  //catches uncaught exceptions
  process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
}

module.exports = {build, serve};

