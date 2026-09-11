const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const files=['index.html','styles.css','armor.js','campaign.js','engine.js','town-ui.js','game.js','favicon.svg','assets/emberdeep.png'];
for(const file of ['armor.js','campaign.js','engine.js','town-ui.js','game.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'),{filename:file});
for(const file of files){const target=path.join(__dirname,'dist',file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(__dirname,file),target);}
console.log('Emberdeep built successfully: '+files.length+' self-contained files in dist/.');
