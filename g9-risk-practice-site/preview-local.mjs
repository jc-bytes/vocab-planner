import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lesson } from './lesson.js';
import { checkActivity } from './activity-check.js';
import { previewLesson, sampleState } from './preview-samples.js';
import { foundationPdfReport } from './shared/foundation-evidence.js';
import { createStudentPdf } from './shared/student-pdf.js';

const root = dirname(fileURLToPath(import.meta.url));
const printable = await readFile(resolve(root,'printable-fallback.html'),'utf8').catch(()=>'');
const fixes = checkActivity(lesson,printable).filter(check=>check.status==='fail');
if (fixes.length) {
  console.error('Fix the activity before previewing:');
  for (const check of fixes) console.error(`- ${check.name}: ${check.detail}`);
  process.exit(1);
}

const preview = previewLesson(lesson);
const font = (await readFile(resolve(root,'shared/pdf-fonts/LiberationSans-Regular.ttf'))).toString('base64');
const canRenderPages = spawnSync('pdftoppm',['-v'],{stdio:'ignore'}).status === 0;
const pdfCache = new Map();
async function samplePdf(mode) {
  if (!['empty','partial','filled'].includes(mode)) return null;
  if (!pdfCache.has(mode)) {
    const report=foundationPdfReport(preview,sampleState(preview,mode));
    const pdf=await createStudentPdf(report,font);
    pdfCache.set(mode,{bytes:Buffer.from(pdf.output('arraybuffer')),pages:pdf.getNumberOfPages()});
  }
  return pdfCache.get(mode);
}
function pageImage(bytes,pageNumber) {
  return new Promise((resolveImage,rejectImage)=>{
    const child=spawn('pdftoppm',['-png','-f',String(pageNumber),'-l',String(pageNumber),'-singlefile','-scale-to','1100','-']);
    const chunks=[];let errors='';
    child.stdout.on('data',chunk=>chunks.push(chunk));
    child.stderr.on('data',chunk=>{errors+=chunk.toString();});
    child.on('error',rejectImage);
    child.on('close',code=>code===0 && chunks.length?resolveImage(Buffer.concat(chunks)):rejectImage(new Error(errors || `PDF render exited ${code} without an image`)));
    child.stdin.end(bytes);
  });
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.pdf':'application/pdf'};
const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Author preview: ${escape(lesson.title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;color:#163642;background:#f6f8f7}header{padding:20px 24px;background:#123f58;color:white}h1{margin:0;font-size:1.5rem}header p{margin:.3rem 0 0}.layout{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}.panel{background:white;border:1px solid #b9ccd1;border-radius:8px;overflow:hidden}.panel h2{font-size:1.05rem;margin:0;padding:12px 16px;background:#eaf3f4}.panel p{margin:8px 16px}.panel iframe{display:block;width:100%;height:520px;border:0}.controls{padding:8px 16px;display:flex;gap:8px;flex-wrap:wrap}.controls button,.controls a{font:inherit;padding:7px 11px;border:1px solid #567982;border-radius:5px;background:white;color:#123f58;cursor:pointer}.controls button[aria-pressed=true]{background:#123f58;color:white}a:focus-visible,button:focus-visible{outline:3px solid #e2a92b;outline-offset:2px}@media(max-width:900px){.layout{grid-template-columns:1fr}}</style><header><h1>Author preview: ${escape(lesson.title)}</h1><p>Local sample work only. Review the real activity, paper version, and PDFs before assigning it.</p></header><div class="layout"><section class="panel"><h2>Student activity</h2><p>Try the page as a student. This frame uses this browser's local saved work.</p><div class="controls"><a href="/" target="_blank">Open full size</a></div><iframe title="Student activity" src="/"></iframe></section><section class="panel"><h2>Paper version</h2><div class="controls"><a href="/printable-fallback.html" target="_blank">Open full size</a></div><iframe title="Paper version" src="/printable-fallback.html"></iframe></section><section class="panel" style="grid-column:1/-1"><h2>Sample student PDFs</h2><p>These fictional samples show blank, partly filled, and filled reports. They are not answer keys.</p><div class="controls"><button data-state="empty">Empty</button><button data-state="partial" aria-pressed="true">Partly filled</button><button data-state="filled">Filled</button><a id="pdf-link" href="/__preview/pdf/partial" target="_blank">Open PDF full size</a></div><iframe id="pdf-frame" title="Sample student PDF" src="/__preview/pages/partial" style="height:650px"></iframe></section></div><script>document.querySelectorAll('[data-state]').forEach(button=>button.addEventListener('click',()=>{const state=button.dataset.state;document.querySelectorAll('[data-state]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.querySelector('#pdf-frame').src='/__preview/pages/'+state;document.querySelector('#pdf-link').href='/__preview/pdf/'+state;}));</script></html>`;

const server = createServer(async (request,response) => {
  const send = (status,type,body) => {response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(body);};
  try {
    const url = new URL(request.url,'http://127.0.0.1');
    if (request.method !== 'GET') return send(405,'text/plain; charset=utf-8','GET only');
    if (url.pathname === '/__preview') return send(200,'text/html; charset=utf-8',page);
    if (url.pathname.startsWith('/__preview/pages/')) {
      const mode=url.pathname.split('/').at(-1), sample=await samplePdf(mode);
      if (!sample) return send(404,'text/plain; charset=utf-8','Unknown sample');
      const body=canRenderPages
        ? Array.from({length:sample.pages},(_,index)=>`<figure><img src="/__preview/png/${mode}/${index+1}" alt="${mode} sample PDF, page ${index+1} of ${sample.pages}"><figcaption>Page ${index+1} of ${sample.pages}</figcaption></figure>`).join('')
        : `<p>This computer cannot render PDF pages in the preview. <a href="/__preview/pdf/${mode}" target="_blank">Open the PDF in a browser PDF viewer</a>.</p>`;
      return send(200,'text/html; charset=utf-8',`<!doctype html><html lang="en"><meta charset="utf-8"><title>${mode} sample PDF pages</title><style>body{font:16px system-ui,sans-serif;background:#e8edf0;margin:16px;color:#163642}figure{margin:0 auto 24px;max-width:850px}img{display:block;width:100%;background:white;box-shadow:0 2px 8px #9cacb4}figcaption{padding:8px;text-align:center}</style>${body}</html>`);
    }
    if (url.pathname.startsWith('/__preview/png/')) {
      const parts=url.pathname.split('/'), mode=parts[3], number=Number(parts[4]), sample=await samplePdf(mode);
      if (!canRenderPages || !sample || !Number.isInteger(number) || number<1 || number>sample.pages) return send(404,'text/plain; charset=utf-8','Unknown page');
      return send(200,'image/png',await pageImage(sample.bytes,number));
    }
    if (url.pathname.startsWith('/__preview/pdf/')) {
      const mode=url.pathname.split('/').at(-1);
      const sample=await samplePdf(mode);
      if (!sample) return send(404,'text/plain; charset=utf-8','Unknown sample');
      return send(200,'application/pdf',sample.bytes);
    }
    const path=resolve(root,decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
    if (path !== root && !path.startsWith(root+sep)) return send(403,'text/plain; charset=utf-8','Forbidden');
    const type=types[extname(path)];
    if (!type) return send(404,'text/plain; charset=utf-8','Not found');
    const body=await readFile(path);
    return send(200,type,body);
  } catch {return send(404,'text/plain; charset=utf-8','Not found');}
});
server.listen(0,'127.0.0.1',()=>console.log(`Author preview: http://127.0.0.1:${server.address().port}/__preview\nPress Ctrl+C to stop.`));
