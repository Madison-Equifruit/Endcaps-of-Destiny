@echo off
echo Starting Banana Badass: Endcaps of Destiny...
echo.
echo Game will open at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server when done.
echo.
cd /d "%~dp0"
start "" "http://localhost:8000"
node -e "const http=require('http'),fs=require('fs'),path=require('path');const mime={'html':'text/html','js':'application/javascript','png':'image/png','wav':'audio/wav','mp3':'audio/mpeg','mp4':'video/mp4','otf':'font/otf'};http.createServer((req,res)=>{let f=path.join(__dirname,req.url==='/'?'index.html':req.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('');}else{const ext=path.extname(f).slice(1);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream'});res.end(d);}});}).listen(8000,()=>console.log('Server running at http://localhost:8000'));"
pause
