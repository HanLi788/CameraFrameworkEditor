// Older generated plans may still be inspected, but current assets never produce one.
const generated=file=>typeof file==='string'&&file.toLowerCase().endsWith('.postprocessingplan');
function writable(file){if(generated(file))throw Error('旧版后处理执行计划为只读文件；请编辑当前框架资产');}
module.exports={generated,writable};
