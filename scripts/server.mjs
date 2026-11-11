import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const base=path.dirname(fileURLToPath(import.meta.url));
const root=fs.existsSync(path.join(base,'dist'))?path.join(base,'dist'):path.resolve(base,'../dist');
const port=4173,host='127.0.0.1',identity='earth-fieldbook-sea-breeze-v1',url=`http://${host}:${port}`;
const open=()=>{if(process.argv.includes('--no-open'))return;if(process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true}).unref()};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}let pathname;try{pathname=decodeURIComponent(new URL(req.url,url).pathname)}catch{res.writeHead(400);res.end();return}
 if(pathname==='/__fieldbook_health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:identity}));return}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Length',stat.size);if(req.method==='HEAD'){res.end();return}const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res)})});
server.on('error',async e=>{if(e.code==='EADDRINUSE'){try{const response=await fetch(url+'/__fieldbook_health',{signal:AbortSignal.timeout(1500)});const data=await response.json();if(data.app===identity){console.log('本课服务已经运行，复用原地址 '+url);open();process.exit(0)}}catch{}console.error('端口 4173 被其他程序占用。请关闭该程序后重试；为保护学习记录，不自动更换地址。')}else console.error(e.message);process.exit(1)});
server.listen(port,host,()=>{console.log(`地球现场已启动：${url}\n仅本机可访问。关闭此窗口可停止服务。`);open()});
