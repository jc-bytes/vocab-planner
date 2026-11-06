// One printable submission, with real text and vector drawings. No screenshot dependency.
let fontPromise;
async function fontData() {
  fontPromise ??= fetch(new URL('./pdf-fonts/LiberationSans-Regular.ttf', import.meta.url))
    .then(response => { if (!response.ok) throw Error('Font unavailable'); return response.arrayBuffer(); })
    .then(buffer => {
      let text = '';
      for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte);
      return btoa(text);
    }).catch(error => { fontPromise = null; throw error; });
  return fontPromise;
}
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function createAssessmentLayout(pdf, report) {
  const pageWidth = 210, pageHeight = 297, left = 16, right = 194, width = right - left;
  const colors = { navy:[18,66,93], teal:[0,125,122], pale:[235,244,246], paper:[249,251,250], line:[190,211,216], ink:[22,54,66], muted:[82,103,116], white:[255,255,255] };
  let y = 0;
  const setText = (rgb) => pdf.setTextColor(...rgb);
  const linesFor = (value, size, maxWidth) => {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(clean(value || ''), maxWidth);
  };
  const newPage = (first = false) => {
    if (!first) pdf.addPage();
    if (first) {
      pdf.setFillColor(...colors.navy); pdf.rect(0,0,pageWidth,31,'F');
      pdf.setFontSize(8); setText(colors.white); pdf.text('ACADEMIA INTERNACIONAL DAVID  ·  TECHNOLOGY',left,10);
      pdf.setFontSize(21); pdf.text(clean(report.title),left,22);
      const nameLines = linesFor(report.name?.trim() || 'Name not entered',10,112);
      const groupLines = linesFor(report.group || 'Group not entered',10,48);
      const rowCount = Math.max(nameLines.length,groupLines.length);
      const boxHeight = Math.max(17,8 + rowCount*4.5);
      pdf.setFillColor(...colors.pale); pdf.setDrawColor(...colors.line); pdf.roundedRect(left,37,width,boxHeight,2,2,'FD');
      pdf.setFontSize(7.5); setText(colors.muted); pdf.text('STUDENT',left+4,42);
      pdf.setFontSize(10); setText(colors.ink); pdf.text(nameLines,left+4,47);
      const groupX=left+122;
      pdf.setFontSize(7.5); setText(colors.muted); pdf.text('GROUP',groupX,42);
      pdf.setFontSize(10); setText(colors.ink); pdf.text(groupLines,groupX,47);
      y=37+boxHeight+5;
      pdf.setFontSize(8.5); setText(colors.muted);
      pdf.text(clean(report.status || 'Student responses for teacher review.'),left,y+3.5);
      y+=9;
    } else {
      pdf.setFillColor(...colors.navy); pdf.rect(0,0,pageWidth,15,'F');
      pdf.setFontSize(8.5); setText(colors.white); pdf.text('PICTURE AND SOUND CHECK  ·  CONTINUED',left,10);
      y=23;
    }
  };
  const lineHeight = size => size*0.48;
  const wrappedHeight = (value,size,maxWidth) => Math.max(1,linesFor(value,size,maxWidth).length)*lineHeight(size);
  const itemHeight = item => {
    if (item.type==='calculation') return 18 + Math.max(wrappedHeight(item.multiplication,9,94),wrappedHeight(item.total,9,55));
    return 12 + Math.max(4.8,wrappedHeight(item.answer || 'Not entered',9,width-12));
  };
  const visualHeight = visual => visual==='pixel-grid' ? 25 : visual==='sample-groups' ? 21 : 0;
  const taskHeight = task => 20 + Math.max(9,wrappedHeight(task.prompt,9,width-14)+4) + (task.visual?visualHeight(task.visual)+3:0) + task.items.reduce((sum,item)=>sum+itemHeight(item)+2,0);
  const drawVisual = (visual,top) => {
    if (visual==='pixel-grid') {
      const cell=4,gap=0.65,startX=left+7;
      const fills=[[0,125,122],[237,189,73],[231,224,201]];
      for(let row=0;row<5;row++)for(let col=0;col<8;col++) {
        const cellNumber=row*8+col+1,fill=cellNumber%5===0?fills[2]:cellNumber%3===0?fills[1]:fills[0];
        pdf.setFillColor(...fill);pdf.setDrawColor(...colors.white);
        pdf.rect(startX+col*(cell+gap),top+row*(cell+gap),cell,cell,'FD');
      }
      return 5*cell+4*gap;
    }
    if (visual==='sample-groups') {
      const gap=3, groupWidth=(width-14-gap*3)/4, startX=left+7;
      for(let second=0;second<4;second++) {
        const x=startX+second*(groupWidth+gap);
        pdf.setFillColor(...colors.white);pdf.setDrawColor(...colors.line);
        pdf.roundedRect(x,top,groupWidth,18,1,1,'FD');
        pdf.setFontSize(7.5);setText(colors.navy);pdf.text(`${second+1} second`,x+groupWidth/2,top+5.2,{align:'center'});
        pdf.setFillColor(...colors.teal);
        const dotGap=5.8,first=x+(groupWidth-4*dotGap)/2;
        for(let dot=0;dot<5;dot++)pdf.circle(first+dot*dotGap,top+12.5,1.35,'F');
      }
      return 18;
    }
    return 0;
  };
  const drawTask = task => {
    const height=taskHeight(task);
    if (y+height>276) newPage();
    const top=y;
    pdf.setFillColor(...colors.white); pdf.setDrawColor(...colors.line); pdf.roundedRect(left,top,width,height,2,2,'FD');
    pdf.setFillColor(...colors.pale); pdf.roundedRect(left,top,width,11,2,2,'F');
    pdf.setFillColor(...colors.teal); pdf.rect(left,top,2,11,'F');
    pdf.setFontSize(11.5); setText(colors.navy); pdf.text(clean(task.heading),left+6,top+7.4);
    const promptLines=linesFor(task.prompt,9,width-14), promptHeight=Math.max(9,promptLines.length*lineHeight(9)+4);
    pdf.setFillColor(...colors.paper); pdf.roundedRect(left+4,top+13,width-8,promptHeight,1.5,1.5,'F');
    pdf.setFontSize(9); setText(colors.ink); pdf.text(promptLines,left+7,top+18);
    let itemY=top+13+promptHeight+3;
    if(task.visual) itemY+=drawVisual(task.visual,itemY)+3;
    for (const item of task.items) {
      const h=itemHeight(item);
      pdf.setFillColor(...colors.white); pdf.setDrawColor(...colors.line); pdf.roundedRect(left+4,itemY,width-8,h,1.5,1.5,'FD');
      pdf.setFontSize(8.5); setText(colors.teal); pdf.text(clean(item.label),left+7,itemY+4.5);
      if (item.type==='calculation') {
        const colGap=4, firstW=99, secondX=left+7+firstW+colGap, secondW=width-18-firstW-colGap;
        pdf.setFontSize(7); setText(colors.muted); pdf.text('MULTIPLICATION',left+7,itemY+8.3); pdf.text('TOTAL',secondX,itemY+8.3);
        pdf.setFontSize(9); setText(item.multiplication?colors.ink:colors.muted);
        pdf.text(linesFor(item.multiplication || 'Not entered',9,firstW),left+7,itemY+13);
        setText(item.total?colors.ink:colors.muted);
        pdf.text(linesFor(item.total || 'Not entered',9,secondW),secondX,itemY+13);
      } else {
        pdf.setFontSize(9); setText(item.answer?colors.ink:colors.muted);
        pdf.text(linesFor(item.answer || 'Not entered',9,width-14),left+7,itemY+10);
      }
      itemY+=h+2;
    }
    y=top+height+5;
  };
  newPage(true);
  for (const task of report.tasks || []) drawTask(task);
  const pageCount=pdf.getNumberOfPages();
  for(let page=1;page<=pageCount;page++) {
    pdf.setPage(page); pdf.setDrawColor(...colors.line); pdf.line(left,282,right,282);
    pdf.setFontSize(8); setText(colors.muted);
    pdf.text('ACADEMIA INTERNACIONAL DAVID  ·  GRADE 9',left,288);
    pdf.text(`${page} / ${pageCount}`,right,288,{align:'right'});
  }
  return pdf;
}

function createStructuredLayout(pdf, report) {
  const pageWidth=210,left=16,right=194,width=right-left,bottom=274;
  const colors={navy:[18,66,93],teal:[0,125,122],pale:[235,244,246],paper:[249,251,250],line:[190,211,216],ink:[22,54,66],muted:[82,103,116],white:[255,255,255]};
  const brand=clean(report.headerLabel||'ACADEMIA INTERNACIONAL DAVID  ·  TECHNOLOGY');
  const footer=clean(report.footerLabel||'ACADEMIA INTERNACIONAL DAVID  ·  TECHNOLOGY');
  let y=0;
  let pageHasTask=false;
  const setText=rgb=>pdf.setTextColor(...rgb);
  const linesFor=(value,size,maxWidth)=>{pdf.setFontSize(size);return pdf.splitTextToSize(clean(value||''),maxWidth);};
  const lineHeight=size=>size*.48;
  const wrappedHeight=(value,size,maxWidth)=>Math.max(1,linesFor(value,size,maxWidth).length)*lineHeight(size);
  const rgbFromHex=value=>{
    const match=String(value||'').match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    return match?match.slice(1).map(part=>parseInt(part,16)):colors.teal;
  };
  const tableRowHeights=visual=>{
    const columns=Array.isArray(visual.columns)?visual.columns:[];
    if(!columns.length)return [];
    const colWidth=(width-12)/columns.length;
    return [columns,...(visual.rows||[])].map(row=>Math.max(9,...row.map(value=>wrappedHeight(String(value??''),8,colWidth-5)+4)));
  };
  const visualHeight=visual=>{
    if(!visual)return 0;
    if(visual.type==='grid'){
      const columns=Math.max(1,Number(visual.columns)||1),rows=Math.ceil((visual.values||[]).length/columns);
      const cell=Math.min(8,(width-10)/columns-.8);
      return rows*(cell+.8)+6;
    }
    if(visual.type==='dot-groups')return Math.ceil((visual.groups||[]).length/4)*23+2;
    if(visual.type==='table')return (visual.caption?7:2)+tableRowHeights(visual).reduce((sum,height)=>sum+height,0)+2;
    return 0;
  };
  const drawVisual=(visual,top)=>{
    if(!visual)return 0;
    if(visual.type==='grid'){
      const columns=Math.max(1,Number(visual.columns)||1),values=Array.isArray(visual.values)?visual.values:[],rows=Math.ceil(values.length/columns),gap=.8;
      const cell=Math.min(8,(width-10)/columns-gap),drawWidth=columns*(cell+gap)-gap,startX=left+(width-drawWidth)/2;
      const palette=Array.isArray(visual.palette)&&visual.palette.length?visual.palette:['#007d7a','#edbd49','#e7e0c9'];
      values.forEach((value,index)=>{
        const colour=palette[Number(value)]??palette[0];pdf.setFillColor(...rgbFromHex(colour));pdf.setDrawColor(...colors.white);
        pdf.rect(startX+(index%columns)*(cell+gap),top+Math.floor(index/columns)*(cell+gap),cell,cell,'FD');
      });
      return rows*(cell+gap)-gap+6;
    }
    if(visual.type==='dot-groups'){
      const groups=Array.isArray(visual.groups)?visual.groups:[],columns=Math.min(4,groups.length),gap=3,groupWidth=(width-12-gap*(columns-1))/columns;
      groups.forEach((group,index)=>{
        const row=Math.floor(index/4),column=index%4,x=left+6+column*(groupWidth+gap),topY=top+row*23;
        pdf.setFillColor(...colors.white);pdf.setDrawColor(...colors.line);pdf.roundedRect(x,topY,groupWidth,20,1,1,'FD');
        pdf.setFontSize(7.5);setText(colors.navy);pdf.text(linesFor(group.label||`Group ${index+1}`,7.5,groupWidth-4).slice(0,1),x+groupWidth/2,topY+6,{align:'center'});
        const count=Math.max(0,Math.min(40,Number(group.dots)||0)),available=groupWidth-7,spacing=count>1?Math.min(5.5,available/(count-.35)):0,radius=count?Math.min(1.6,spacing*.31):0;
        const dotsWidth=count>1?(count-1)*spacing:0,first=x+(groupWidth-dotsWidth)/2;
        pdf.setFillColor(...colors.teal);for(let dot=0;dot<count;dot++)pdf.circle(first+dot*spacing,topY+14.3,radius,'F');
      });
      return Math.ceil(groups.length/4)*23+2;
    }
    if(visual.type==='table'){
      const columns=Array.isArray(visual.columns)?visual.columns:[],rows=Array.isArray(visual.rows)?visual.rows:[],colWidth=(width-12)/Math.max(1,columns.length);
      let tableY=top+2;
      if(visual.caption){pdf.setFontSize(8.5);setText(colors.teal);pdf.text(linesFor(visual.caption,8.5,width-12),left+6,tableY+4);tableY+=7;}
      const allRows=[columns,...rows],heights=tableRowHeights(visual);
      allRows.forEach((row,rowIndex)=>{
        const height=heights[rowIndex]||9;
        row.forEach((value,columnIndex)=>{
          const x=left+6+columnIndex*colWidth;
          pdf.setFillColor(...(rowIndex===0?colors.pale:colors.white));pdf.setDrawColor(...colors.line);pdf.rect(x,tableY,colWidth,height,'FD');
          pdf.setFontSize(8);setText(rowIndex===0?colors.navy:colors.ink);pdf.text(linesFor(String(value??''),8,colWidth-5),x+2.5,tableY+5);
        });
        tableY+=height;
      });
      return tableY-top+2;
    }
    return 0;
  };
  const newPage=(first=false)=>{
    if(!first)pdf.addPage();
    pageHasTask=false;
    if(first){
      const titleLines=linesFor(report.title,18,width-8),bandHeight=Math.max(31,13+titleLines.length*7.2);
      pdf.setFillColor(...colors.navy);pdf.rect(0,0,pageWidth,bandHeight,'F');pdf.setFontSize(8);setText(colors.white);pdf.text(brand,left,8);
      pdf.setFontSize(18);pdf.text(titleLines,left,20);
      const panelTop=bandHeight+5,nameLines=linesFor(report.name?.trim()||'Name not entered',9,84),groupLines=linesFor(report.group||'Group not entered',9,36),dateLines=linesFor(report.date||new Date().toLocaleDateString(),8.5,34);
      const valueLines=Math.max(nameLines.length,groupLines.length,dateLines.length),panelHeight=Math.max(17,11+valueLines*4.4);
      pdf.setFillColor(...colors.pale);pdf.setDrawColor(...colors.line);pdf.roundedRect(left,panelTop,width,panelHeight,2,2,'FD');
      pdf.setFontSize(7);setText(colors.muted);pdf.text('STUDENT',left+4,panelTop+4.5);pdf.text('GRADE / GROUP',left+99,panelTop+4.5);pdf.text('DATE',left+145,panelTop+4.5);
      pdf.setFontSize(9);setText(colors.ink);pdf.text(nameLines,left+4,panelTop+10);pdf.text(groupLines,left+99,panelTop+10);pdf.text(dateLines,left+145,panelTop+10);
      y=panelTop+panelHeight+4;
      const statusLines=linesFor(report.status||'Student work for teacher review.',8.5,width);
      pdf.setFontSize(8.5);setText(colors.muted);pdf.text(statusLines,left,y+3);y+=statusLines.length*lineHeight(8.5)+6;
      if(report.version){const versionLines=linesFor(`Version ${report.version}`,7.5,width);pdf.setFontSize(7.5);setText(colors.muted);pdf.text(versionLines,left,y);y+=versionLines.length*lineHeight(7.5)+3;}
    }else{
      pdf.setFillColor(...colors.navy);pdf.rect(0,0,pageWidth,15,'F');pdf.setFontSize(8.5);setText(colors.white);
      pdf.text(linesFor(`${report.title||'Student work'}  ·  CONTINUED`,8.5,width),left,10);y=23;
    }
  };
  const drawTaskLabel=(task,continued=false)=>{
    const heading=continued?`${task.heading||'Task'}  ·  CONTINUED`:task.heading||'Task';
    pdf.setFillColor(...colors.pale);pdf.roundedRect(left,y,width,11,2,2,'F');pdf.setFillColor(...colors.teal);pdf.rect(left,y,2,11,'F');
    pdf.setFontSize(11.5);setText(colors.navy);pdf.text(linesFor(heading,11.5,width-12).slice(0,1),left+6,y+7.4);y+=14;
    pageHasTask=true;
  };
  const drawPrompt=prompt=>{
    const promptLines=linesFor(prompt||'Student responses for this section.',9,width-14),height=Math.max(9,promptLines.length*lineHeight(9)+4);
    pdf.setFillColor(...colors.paper);pdf.roundedRect(left+4,y,width-8,height,1.5,1.5,'F');pdf.setFontSize(9);setText(colors.ink);pdf.text(promptLines,left+7,y+5);y+=height+3;
  };
  const itemLabelHeight=item=>wrappedHeight(item.label||'Response',8.5,width-12);
  const itemHeight=item=>{
    const labelHeight=itemLabelHeight(item);
    if(item.type==='calculation')return 8+labelHeight+7+Math.max(wrappedHeight(item.multiplication||'Not entered',9,width*.53),wrappedHeight(item.total||'Not entered',9,width*.34))+3;
    return 7+labelHeight+Math.max(4.8,wrappedHeight(item.answer||'Not entered',9,width-12))+4;
  };
  const drawItem=(item,top)=>{
    const height=itemHeight(item),labelLines=linesFor(item.label||'Response',8.5,width-12);
    pdf.setFillColor(...colors.white);pdf.setDrawColor(...colors.line);pdf.roundedRect(left+4,top,width-8,height,1.5,1.5,'FD');
    pdf.setFontSize(8.5);setText(colors.teal);pdf.text(labelLines,left+7,top+4.5);
    const bodyTop=top+4+labelLines.length*lineHeight(8.5);
    if(item.type==='calculation'){
      const colGap=4,firstW=width*.53,secondX=left+7+firstW+colGap,secondW=width-18-firstW-colGap;
      pdf.setFontSize(7);setText(colors.muted);pdf.text('MULTIPLICATION',left+7,bodyTop+3.3);pdf.text('TOTAL',secondX,bodyTop+3.3);
      pdf.setFontSize(9);setText(item.multiplication?colors.ink:colors.muted);pdf.text(linesFor(item.multiplication||'Not entered',9,firstW),left+7,bodyTop+8);
      setText(item.total?colors.ink:colors.muted);pdf.text(linesFor(item.total||'Not entered',9,secondW),secondX,bodyTop+8);
    }else{
      pdf.setFontSize(9);setText(item.answer?colors.ink:colors.muted);pdf.text(linesFor(item.answer||'Not entered',9,width-12),left+7,bodyTop+5);
    }
    return height;
  };
  newPage(true);
  for(const task of report.tasks||[]){
    if(task.pageBreakBefore&&pageHasTask)newPage();
    const promptLines=linesFor(task.prompt||'Student responses for this section.',9,width-14),promptHeight=Math.max(9,promptLines.length*lineHeight(9)+4),visual=task.visual,graphicHeight=visualHeight(visual),introHeight=14+promptHeight+(visual?graphicHeight+3:0);
    if(y+introHeight>bottom)newPage();
    drawTaskLabel(task);
    drawPrompt(task.prompt);
    if(visual){y+=drawVisual(visual,y)+3;}
    for(const item of task.items||[]){
      const height=itemHeight(item);
      if(y+height>bottom){newPage();drawTaskLabel(task,true);drawPrompt(task.prompt);}
      y+=drawItem(item,y)+3;
    }
    y+=3;
  }
  const pages=pdf.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    pdf.setPage(page);pdf.setDrawColor(...colors.line);pdf.line(left,282,right,282);pdf.setFontSize(8);setText(colors.muted);
    pdf.text(footer,left,288);pdf.text(`${page} / ${pages}`,right,288,{align:'right'});
  }
  return pdf;
}

export async function createStudentPdf(report, font) {
  const jspdfModule = await import('./jspdf.umd.min.js');
  const { jsPDF } = globalThis.jspdf || jspdfModule.default || jspdfModule;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS('StudentSans.ttf', font || await fontData());
  pdf.addFont('StudentSans.ttf', 'StudentSans', 'normal');
  pdf.setFont('StudentSans');
  pdf.setProperties({ title: clean(report.title), subject: `Student work · MOD-DIGITAL-REPRESENTATION-01 · ${report.version}`, creator: 'Technology learning hub', keywords: report.sections?.join(', ') || '' });
  if (report.layout === 'assessment') return createAssessmentLayout(pdf,report);
  if (report.layout === 'structured') return createStructuredLayout(pdf,report);
  let y = 22;
  const space = height => { if (y + height > 275) { pdf.addPage(); y = 22; } };
  const text = (value, size = 11, after = 3) => {
    pdf.setFontSize(size); pdf.setTextColor('#163642');
    const lines = pdf.splitTextToSize(clean(value), 174);
    const step = size * 0.46;
    for (const line of lines) { space(step); pdf.text(line, 18, y); y += step; }
    y += after;
  };
  text(report.title, 21, 5);
  text(`Name: ${report.name?.trim() || 'Name not entered'}${report.group ? '    Group: ' + report.group : ''}`);
  text(report.status || 'Practice work. Teacher reviews explanations.', 10, 5);
  for (const block of report.blocks) {
    if (block.heading) { space(20); text(block.heading, 15, 3); }
    if (block.label) {
      pdf.setFontSize(11);
      space(Math.min(55, pdf.splitTextToSize(clean(block.label), 174).length * 5.1 + 16));
      text(block.label, 11, 1);
      text(`My answer: ${block.answer?.trim() || 'No answer yet'}`, 11, 3);
    }
    if (block.text) text(block.text);
    if (block.grid) {
      const { columns, values, palette } = block.grid;
      const cell = 12, height = Math.ceil(values.length / columns) * cell;
      space(height + 8);
      values.forEach((value, i) => {
        pdf.setFillColor(palette[value]); pdf.setDrawColor('#536b75'); pdf.setLineWidth(0.25);
        pdf.rect(18 + (i % columns) * cell, y + Math.floor(i / columns) * cell, cell, cell, 'FD');
      });
      y += height + 8;
    }
    if (block.strip) {
      space(33);
      block.strip.forEach((count, i) => {
        const x = 18 + i * 43;
        pdf.setDrawColor('#789398'); pdf.rect(x, y, 43, 25);
        pdf.setFontSize(10); pdf.text(`Second ${i + 1}: ${count} samples`, x + 3, y + 7);
        pdf.setFillColor('#007d7a');
        for (let dot = 0; dot < count; dot++) pdf.circle(x + 7 + dot * 7, y + 17, 1.8, 'F');
      });
      y += 33;
    }
  }
  text(`Saved: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, 9);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor('#789398'); pdf.line(18, 282, 192, 282);
    pdf.setFontSize(9); pdf.setTextColor('#536b75'); pdf.text(`${page} / ${pages}`, 192, 288, { align: 'right' });
  }
  return pdf;
}

export async function downloadStudentPdf(report, filename, button, notify) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  notify('Preparing your PDF…');
  try {
    const pdf = await createStudentPdf(report);
    const url = URL.createObjectURL(pdf.output('blob'));
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    notify(report.status?.startsWith('Draft:') ? `Draft PDF ready: ${filename}. Some fields are blank. Finish your work before turning it in.` : `PDF ready: ${filename}. Open it, then attach it to Classroom and select Turn in.`);
  } catch {
    notify('The PDF could not be saved. Try Download PDF again. If it still fails, ask your teacher for help. Your work is still on this page.');
  } finally { if (button) button.disabled = false; }
}
