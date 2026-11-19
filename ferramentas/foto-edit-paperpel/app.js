(()=>{
 const $=id=>document.getElementById(id), DPI=300, CM=DPI/2.54;
 const COLORS=['#AFD6F0','#FFED87','#D0B9ED','#FCC99A','#F7C6E3','#E7FCAE'];
 const specs={
  standard:{name:'Polaroid Padrão',w:8,h:10,photoW:7,photoH:7.5,photoX:.5,photoY:.5},
  mini:{name:'Polaroid Mini',w:6.1,h:7.1,photoW:5,photoH:5.1,photoX:.55,photoY:.35},
  magnet:{name:'Foto-Ímã',w:9,h:6,photoW:8.3,photoH:5.3,photoX:.35,photoY:.35}
 };
 const papers={a4:{w:21,h:29.7,label:'A4'},photo:{w:10,h:15,label:'10 × 15 cm'}};
 const state={kind:'standard',items:[],pages:[],page:0,paper:'a4',showPhotoGuide:true,circleSize:5,natal:false,manualBack:false,selectedIndex:-1};
 const imageCache=new WeakMap();
 const itemValue=(item,key,back=state.manualBack)=>back&&state.manualBack&&item[`back${key[0].toUpperCase()}${key.slice(1)}`]!==undefined?item[`back${key[0].toUpperCase()}${key.slice(1)}`]:(item[key]??(key==='zoom'?1:0));
 const setItemValue=(item,key,value)=>{const prop=state.kind==='circle'&&state.natal&&state.manualBack?`back${key[0].toUpperCase()}${key.slice(1)}`:key;item[prop]=value;};
 const natalIcon=new Image();natalIcon.src='assets/natal-icon.png';natalIcon.onload=()=>{if(state.kind==='circle')updatePreviewOnly()};
 const preview=$('preview'),ctx=preview.getContext('2d');
 // Zoom da pré-visualização por scroll removido; o zoom das imagens continua pelos controles e teclado.
 const setStatus=t=>$('status').textContent=t;
 $('toolMenuBtn').addEventListener('click',()=>$('toolMenu').classList.toggle('hidden'));
 document.addEventListener('click',e=>{if(!e.target.closest('.brand-wrap'))$('toolMenu').classList.add('hidden')});
 function renderTabs(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.kind===state.kind));$('borderOptions').classList.toggle('hidden',state.kind!=='mini');$('circleOptions').classList.toggle('hidden',state.kind!=='circle');$('manualBackToggle').classList.toggle('hidden',!(state.kind==='circle'&&state.natal));$('manualBack').checked=state.manualBack;if(state.kind==='circle'){$('circleSize').value=state.natal?'6.3':state.circleSize;$('circleSize').disabled=state.natal;}}
 function paperOptions(){let options=[];if(state.kind==='standard'){options=[{id:'photo',label:'10 × 15 cm (1 foto)'},{id:'a4',label:'A4 (6 fotos por página)'}];state.paper=state.items.reduce((n,x)=>n+x.qty,0)===1?'photo':'a4';}
 else if(state.kind==='mini'){let q=totalQty();options=[{id:'photo',label:'10 × 15 cm (até 2 fotos)'},{id:'mini6',label:'A4 — metade da folha (6 fotos)'},{id:'a4',label:'A4 — folha inteira (12 fotos)'}];state.paper=q<=2?'photo':q<=6?'mini6':'a4';}
 else {options=[{id:'a4',label:'A4 (até 8 fotos)'}];state.paper='a4';}
 $('paperMode').innerHTML=options.map(o=>`<option value="${o.id}" ${o.id===state.paper?'selected':''}>${o.label}</option>`).join('');$('paperMode').disabled=options.length===1;
 }
 function totalQty(){return state.items.reduce((s,x)=>s+x.qty,0)}
 function renderList(){
  const list=$('fileList'),scrollTop=list.scrollTop;
  const focusedRow=list.contains(document.activeElement)?document.activeElement.closest('.file-row'):null;
  const focusedIndex=focusedRow?Array.from(list.children).indexOf(focusedRow):-1;
  list.innerHTML='';
  state.items.forEach((item,i)=>{
   const row=document.createElement('div');row.className='file-row'+(state.selectedIndex===i?' selected':'');row.tabIndex=0;row.setAttribute('aria-label',`Selecionar ${item.name}`);
   const select=()=>{state.selectedIndex=i;list.querySelectorAll('.file-row').forEach((el,index)=>el.classList.toggle('selected',index===i));};
   row.addEventListener('focusin',select);
   row.addEventListener('click',e=>{if(e.target.closest('button,input,label'))return;select()});
   row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
   const img=document.createElement('img');img.className='thumb';img.src=item.url;img.addEventListener('click',select);
   const info=document.createElement('div');info.className='file-info';const name=document.createElement('span');name.className='filename';name.textContent=item.name;
   const controls=document.createElement('div');controls.className='file-controls';
   const fit=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!itemValue(item,'fit');cb.addEventListener('change',()=>{state.selectedIndex=i;setItemValue(item,'fit',cb.checked);if(cb.checked){setItemValue(item,'zoom',1);setItemValue(item,'panX',0);setItemValue(item,'panY',0);}update();});fit.append(cb,document.createTextNode('Ajustar ao quadro'));controls.append(fit);
   const pan=document.createElement('div');pan.className='pan-buttons';
   const syncZoomDisplay=()=>{
    const value=Math.round(itemValue(item,'zoom')*100);
    const slider=zoomWrap.querySelector('input[type="range"]');
    const sliderValue=zoomWrap.querySelector('span');
    if(slider)slider.value=value;
    if(sliderValue)sliderValue.textContent=value+'%';
   };
   const move=(key,delta)=>{state.selectedIndex=i;select();setItemValue(item,key,Math.max(-50,Math.min(50,itemValue(item,key)+delta)));updatePreviewOnly();};
   [['−','zoomOut'],['+','zoomIn'],['←','left'],['↑','up'],['↓','down'],['→','right']].forEach(([label,action])=>{
    const b=document.createElement('button');b.type='button';b.className='edit-key '+(action.startsWith('zoom')?'zoom-key':'arrow-key');b.textContent=label;
    if(action==='zoomOut')b.title='Diminuir zoom';if(action==='zoomIn')b.title='Aumentar zoom';
    b.addEventListener('click',e=>{e.stopPropagation();state.selectedIndex=i;select();if(action==='zoomOut'||action==='zoomIn'){const z=Math.max(.5,Math.min(3,itemValue(item,'zoom')+(action==='zoomIn'?.1:-.1)));setItemValue(item,'zoom',Math.round(z*100)/100);updatePreviewOnly();syncZoomDisplay()}else if(action==='left')move('panX',-2);else if(action==='right')move('panX',2);else if(action==='up')move('panY',-2);else if(action==='down')move('panY',2)});
    pan.append(b);
   });
   const zoomWrap=document.createElement('label');zoomWrap.className='zoom-control';zoomWrap.textContent='Zoom da imagem';const zoom=document.createElement('input');zoom.type='range';zoom.min='50';zoom.max='300';zoom.step='1';zoom.value=Math.round(itemValue(item,'zoom')*100);zoom.title='50% a 300%';
   const zoomValue=document.createElement('span');zoomValue.textContent=zoom.value+'%';zoom.addEventListener('pointerdown',()=>{state.selectedIndex=i;select()});zoom.addEventListener('focus',()=>{state.selectedIndex=i;select()});zoom.addEventListener('input',()=>{state.selectedIndex=i;select();setItemValue(item,'zoom',Number(zoom.value)/100);zoomValue.textContent=zoom.value+'%';updatePreviewOnly()});zoomWrap.append(zoom,zoomValue);
   info.append(name,controls,pan,zoomWrap);
   const tools=document.createElement('div');tools.append(Object.assign(document.createElement('button'),{className:'rotate-btn',textContent:'↻',title:'Girar 90°',onclick:()=>{state.selectedIndex=i;setItemValue(item,'rotation',(itemValue(item,'rotation')+90)%360);update()}}),Object.assign(document.createElement('button'),{className:'remove-btn',textContent:'×',title:'Remover',onclick:()=>{URL.revokeObjectURL(item.url);state.items.splice(i,1);if(state.selectedIndex===i)state.selectedIndex=state.items.length?Math.min(i,state.items.length-1):-1;else if(state.selectedIndex>i)state.selectedIndex--;update()}}));
   row.append(img,info,tools);
   // Tab percorre somente os blocos azuis; controles internos continuam clicáveis, mas fora da sequência de Tab.
   row.querySelectorAll('button,input,select,a,[tabindex]').forEach(control=>control.tabIndex=-1);
   list.append(row);
  });
  list.scrollTop=scrollTop;
  const fitAll=$('fitAll');
  const fitCount=state.items.filter(item=>!!itemValue(item,'fit')).length;
  fitAll.disabled=state.items.length===0;
  fitAll.checked=state.items.length>0&&fitCount===state.items.length;
  fitAll.indeterminate=fitCount>0&&fitCount<state.items.length;
  if(focusedIndex>=0&&list.children[focusedIndex])list.children[focusedIndex].focus({preventScroll:true});
 }
 function addImage(file,img){state.items.push({name:file.name,url:URL.createObjectURL(file),image:img,qty:1,fit:false,rotation:0,panX:0,panY:0,zoom:1});}
  $('fitAll').addEventListener('change',()=>{
   const enabled=$('fitAll').checked;
   state.items.forEach(item=>{
    setItemValue(item,'fit',enabled);
    if(enabled){
     setItemValue(item,'zoom',1);
     setItemValue(item,'panX',0);
     setItemValue(item,'panY',0);
    }
   });
   update();
  });
 async function loadFiles(files){for(const file of [...files]){if(file.type==='application/pdf'){await loadPdf(file);continue}if(!/^image\/(png|jpeg)$/.test(file.type))continue;const url=URL.createObjectURL(file);const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});state.items.push({name:file.name,url,image:img,qty:1,fit:state.items.length>0&&state.items.every(x=>!!itemValue(x,'fit')),rotation:0,panX:0,panY:0,zoom:1});if(state.selectedIndex<0)state.selectedIndex=state.items.length-1;}update();}
 async function loadPdf(file){if(!window.pdfjsLib){setStatus('Para importar PDF, aguarde o carregamento do leitor de PDF e tente novamente.');return}const data=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data}).promise;for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),vp=page.getViewport({scale:3});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const im=new Image();im.src=c.toDataURL('image/png');await new Promise(r=>im.onload=r);state.items.push({name:`${file.name} • página ${p}`,url:im.src,image:im,qty:1,fit:state.items.length>0&&state.items.every(x=>!!itemValue(x,'fit')),rotation:0,panX:0,panY:0,zoom:1});if(state.selectedIndex<0)state.selectedIndex=state.items.length-1;}}
 function pagePlan(){
  if(state.kind==='circle'){
   const gap=.5, natal=state.natal, diameter=natal?6.3:Math.max(1,Math.min(30,Number(state.circleSize)||5)), backDiameter=6.5;
   const formats=[{id:'photo',w:10,h:15,label:'10 × 15 cm'},{id:'a5',w:14.8,h:21,label:'A5'},{id:'a4',w:21,h:29.7,label:'A4'},{id:'sra3',w:32,h:45,label:'SRA3'}];
   const fit=(f,d)=>({cols:Math.max(0,Math.floor((f.w+gap+1e-8)/(d+gap))),rows:Math.max(0,Math.floor((f.h+gap+1e-8)/(d+gap)))});
   const q=totalQty();let chosen=formats[formats.length-1],grid=fit(chosen,diameter);
   for(const f of formats){const g=fit(f,diameter);if(g.cols*g.rows>=Math.max(1,q)){chosen=f;grid=g;break}}
   state.paper=chosen.id;
   const cap=Math.max(1,grid.cols*grid.rows),ordered=[];state.items.forEach(item=>{for(let n=0;n<item.qty;n++)ordered.push(item)});
   const pages=[];
   if(natal){
    if(!ordered.length){pages.push({items:[],side:'front'});pages.push({items:[],side:'back'});}
    else for(let i=0;i<ordered.length;i+=cap){
     const batch=ordered.slice(i,i+cap);
     pages.push({items:batch,side:'front'});
     // Completa a grade inteira com posições vazias antes de espelhar.
     // Cada linha é invertida por completo, inclusive quando está incompleta.
     // Ex.: [7, 8, vazio] passa a [vazio, 8, 7].
     const gridItems=Array.from({length:cap},(_,index)=>batch[index]??null);
     const mirrored=[];
     for(let start=0;start<cap;start+=grid.cols){
      mirrored.push(...gridItems.slice(start,start+grid.cols).reverse());
     }
     pages.push({items:mirrored,side:'back'});
    }
   }else for(let i=0;i<ordered.length;i+=cap)pages.push({items:ordered.slice(i,i+cap),side:'front'});
   return {circle:true,natal,diameter,backDiameter,gap,pw:chosen.w,ph:chosen.h,label:chosen.label,cols:grid.cols,rows:grid.rows,cap,pages};
  }
  const s=specs[state.kind],q=totalQty(),paper=state.paper;let pw,ph,cols,rows,cap,margin=.7,gap=0,top=margin;
  if(state.kind==='standard'){if(paper==='photo'){pw=10;ph=15;cols=1;rows=1;cap=1;margin=.5;gap=0}else{pw=29.7;ph=21;cols=3;rows=2;cap=6;margin=.3;gap=0}}
  if(state.kind==='mini'){if(paper==='photo'){pw=10;ph=15;cols=1;rows=2;cap=2;margin=.5;gap=0}else if(paper==='mini6'){pw=21;ph=29.7;cols=3;rows=2;cap=6;margin=.7;gap=0}else{pw=21;ph=29.7;cols=3;rows=4;cap=12;margin=.7;gap=0}}
  if(state.kind==='magnet'){pw=21;ph=29.7;cols=2;rows=4;cap=8;margin=.7;gap=0}
  const ordered=[];state.items.forEach(item=>{for(let n=0;n<item.qty;n++)ordered.push(item)});const pages=[];for(let i=0;i<ordered.length;i+=cap)pages.push(ordered.slice(i,i+cap));
  return {s,pw,ph,cols,rows,cap,margin,gap,pages,mini6:state.kind==='mini'&&paper==='mini6'};
 }
 function enhanceImage(source){const auto=$('autoColor').checked,cached=imageCache.get(source);if(cached&&cached.auto===auto)return cached.canvas;const c=document.createElement('canvas');c.width=source.naturalWidth||source.width;c.height=source.naturalHeight||source.height;const x=c.getContext('2d');x.drawImage(source,0,0,c.width,c.height);if(auto){const d=x.getImageData(0,0,c.width,c.height),a=d.data;let lo=255,hi=0;for(let i=0;i<a.length;i+=4){const y=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];if(y<lo)lo=y;if(y>hi)hi=y}const range=Math.max(1,hi-lo);for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++)a[i+k]=Math.max(0,Math.min(255,(a[i+k]-lo)*255/range));}x.putImageData(d,0,0);}imageCache.set(source,{auto,canvas:c});return c;}
 function drawCard(target,item,index,layout,x,y){const {s}=layout,scale=target.canvas.width/layout.pw,w=s.w*scale,h=s.h*scale,px=x+s.photoX*scale,py=y+s.photoY*scale,pw=s.photoW*scale,ph=s.photoH*scale;target.save();target.fillStyle=state.kind==='mini'&&$('colorBorder').checked?COLORS[index%6]:'#fff';target.fillRect(x,y,w,h);target.strokeStyle=state.kind==='mini'&&$('colorBorder').checked?COLORS[index%6]:'#bfc0c2';target.lineWidth=Math.max(1,scale*.012);target.strokeRect(x,y,w,h);target.save();target.beginPath();target.rect(px,py,pw,ph);target.clip();target.fillStyle='#fff';target.fillRect(px,py,pw,ph);if(item&&item.image){const src=enhanceImage(item.image);const rotation=((item.rotation||0)%360);const quarter=Math.abs(rotation%180)===90;const fitW=quarter?ph:pw,fitH=quarter?pw:ph;const factor=item.fit?Math.max(fitW/src.width,fitH/src.height):Math.min(fitW/src.width,fitH/src.height);const zoom=Math.max(.5,Math.min(3,item.zoom||1));const dw=src.width*factor*zoom,dh=src.height*factor*zoom;target.translate(px+pw/2+(item.panX||0)*pw/100,py+ph/2+(item.panY||0)*ph/100);target.rotate(rotation*Math.PI/180);target.drawImage(src,-dw/2,-dh/2,dw,dh);}else{target.fillStyle='#e5e6e8';target.fillRect(px,py,pw,ph);}target.restore();if(state.showPhotoGuide){target.strokeStyle='#d0d1d3';target.lineWidth=Math.max(1,scale*.012);target.strokeRect(px,py,pw,ph);}target.restore();}
 function renderPage(canvas,pageIndex,high){
  const plan=pagePlan(),pageData=plan.pages[pageIndex]||[],items=plan.circle?pageData.items:pageData;
  const scale=high?CM:Math.min(38,780/(plan.pw),1050/(plan.ph));canvas.width=Math.round(plan.pw*scale);canvas.height=Math.round(plan.ph*scale);const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
  if(plan.circle){
   if(plan.natal){c.save();c.fillStyle='#b8b8b8';c.font=`${Math.max(8,scale*.22)}px Arial`;c.textAlign='left';c.textBaseline='top';c.fillText(pageData.side==='back'?'VERSO':'FRENTE',.35*scale,.28*scale);c.restore();}
   const d=pageData.side==='back'&&plan.natal?plan.backDiameter:plan.diameter,pitch=plan.diameter+plan.gap,gridW=plan.cols*pitch-plan.gap,gridH=plan.rows*pitch-plan.gap,startX=(plan.pw-gridW)/2,startY=(plan.ph-gridH)/2;
   for(let i=0;i<plan.cap;i++){const r=Math.floor(i/plan.cols),col=i%plan.cols,cx=(startX+col*pitch+plan.diameter/2)*scale,cy=(startY+r*pitch+plan.diameter/2)*scale,rad=d*scale/2,item=items[i]||null;
    c.save();c.beginPath();c.arc(cx,cy,rad,0,Math.PI*2);c.closePath();c.clip();
    if(item&&item.image){const back=pageData.side==='back'&&plan.natal,src=enhanceImage(item.image),imageDiameter=back?plan.diameter:d,factor=Math.max((imageDiameter*scale)/src.width,(imageDiameter*scale)/src.height),zoom=Math.max(.5,Math.min(3,itemValue(item,'zoom',back))),dw=src.width*factor*zoom,dh=src.height*factor*zoom;c.translate(cx+itemValue(item,'panX',back)*rad/50,cy+itemValue(item,'panY',back)*rad/50);c.rotate(itemValue(item,'rotation',back)*Math.PI/180);c.drawImage(src,-dw/2,-dh/2,dw,dh);}
    else {c.fillStyle='#fff';c.fillRect(cx-rad,cy-rad,rad*2,rad*2);if(plan.natal&&natalIcon.complete&&natalIcon.naturalWidth){const size=rad*1.18;c.drawImage(natalIcon,cx-size/2,cy-size/2,size,size);}}
    c.restore();if(state.showPhotoGuide){c.save();c.beginPath();c.arc(cx,cy,rad,0,Math.PI*2);c.strokeStyle='#c6c7c9';c.lineWidth=Math.max(1,scale*.012);c.stroke();c.restore();}
   }return;
  }
  const cardW=plan.s.w,cardH=plan.s.h,rowsUsed=plan.rows,gridW=plan.cols*cardW+(plan.cols-1)*plan.gap,gridH=rowsUsed*cardH+(rowsUsed-1)*plan.gap;const startX=(plan.pw-gridW)/2,startY=plan.mini6?plan.margin:(plan.ph-gridH)/2;for(let i=0;i<plan.cap;i++){const r=Math.floor(i/plan.cols),col=i%plan.cols;const x=(startX+col*(cardW+plan.gap))*scale,y=(startY+r*(cardH+plan.gap))*scale;drawCard(c,items[i]||null,i+pageIndex*plan.cap,plan,x,y);}
 }
 function updatePreviewOnly(){const plan=pagePlan();state.pages=plan.pages;renderPage(preview,state.page,false);}
 function update(){renderTabs();renderList();paperOptions();const plan=pagePlan();state.pages=plan.pages;state.page=Math.min(state.page,Math.max(0,state.pages.length-1));renderPage(preview,state.page,false);$('paperLabel').textContent=plan.pw+' × '+plan.ph+' cm • '+(plan.circle?'Círculo':specs[state.kind].name);$('pageLabel').textContent=`Página ${state.pages.length?state.page+1:0} / ${state.pages.length}`;$('prevPage').disabled=state.page<=0;$('nextPage').disabled=state.page>=state.pages.length-1;$('rules').textContent=state.kind==='circle'?'Círculo: diâmetro '+(state.natal?'6,3 cm (frente) / 6,5 cm (verso)':state.circleSize+' cm')+' • espaçamento de 0,5 cm • '+plan.label:state.kind==='standard'?'Padrão: 8 × 10 cm • área da foto 7 × 7,5 cm • 1 unidade em 10 × 15 cm; a partir de 2, A4 com até 6 por página.':state.kind==='mini'?'Mini: 6,1 × 7,1 cm • área da foto 5 × 5,1 cm • até 2 em 10 × 15 cm, 6 na metade superior do A4 ou 12 na folha inteira.':'Foto-Ímã: 9 × 6 cm • área da foto 8,3 × 5,3 cm • até 8 por A4.';setStatus(state.items.length?`${totalQty()} foto(s) • ${state.pages.length} página(s) • saída em 300 DPI`:'Arquivos em alta resolução • saída em 300 DPI');}
 async function downloadPng(){if(!state.pages.length)return;const c=document.createElement('canvas');renderPage(c,state.page,true);c.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`paperpel-foto-edit-${state.kind}-pagina-${state.page+1}.png`;a.click();URL.revokeObjectURL(a.href)},'image/png');}
 async function downloadPdf(){if(!state.pages.length)return;if(!window.jspdf?.jsPDF){setStatus('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.');return}const plan=pagePlan(),{jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:plan.pw>plan.ph?'landscape':'portrait',unit:'mm',format:[plan.pw*10,plan.ph*10],compress:true});for(let i=0;i<plan.pages.length;i++){if(i)pdf.addPage([plan.pw*10,plan.ph*10],plan.pw>plan.ph?'landscape':'portrait');const c=document.createElement('canvas');renderPage(c,i,true);const data=c.toDataURL('image/jpeg',.98);pdf.addImage(data,'JPEG',0,0,plan.pw*10,plan.ph*10,undefined,'FAST')}pdf.save(`paperpel-foto-edit-${state.kind}.pdf`);setStatus(`PDF gerado com ${plan.pages.length} página(s) em 300 DPI.`)}
 document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.kind=b.dataset.kind;state.manualBack=false;$('manualBack').checked=false;state.page=0;update()}));$('fileInput').addEventListener('change',e=>{loadFiles(e.target.files);e.target.value=''});$('paperMode').addEventListener('change',()=>{state.paper=$('paperMode').value;state.page=0;update()});$('autoColor').addEventListener('change',update);$('showPhotoGuide').addEventListener('change',()=>{state.showPhotoGuide=$('showPhotoGuide').checked;updatePreviewOnly()});$('colorBorder').addEventListener('change',update);$('circleSize').addEventListener('change',()=>{state.circleSize=Math.max(1,Math.min(30,Number($('circleSize').value)||5));state.page=0;update()});$('christmasBall').addEventListener('change',()=>{state.natal=$('christmasBall').checked;state.manualBack=false;state.page=0;update()});$('manualBack').addEventListener('change',()=>{state.manualBack=$('manualBack').checked;if(state.manualBack){state.items.forEach(item=>{item.backZoom=item.zoom??1;item.backPanX=item.panX??0;item.backPanY=item.panY??0;item.backRotation=item.rotation??0;item.backFit=!!item.fit;});const backPage=state.pages.findIndex(p=>p.side==='back');if(backPage>=0)state.page=backPage;}else{state.items.forEach(item=>{delete item.backZoom;delete item.backPanX;delete item.backPanY;delete item.backRotation;delete item.backFit;});if(state.pages[state.page]?.side==='back')state.page=Math.max(0,state.page-1);}update()});$('prevPage').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);renderPage(preview,state.page,false);updateNav()});$('nextPage').addEventListener('click',()=>{state.page=Math.min(state.pages.length-1,state.page+1);renderPage(preview,state.page,false);updateNav()});function updateNav(){$('pageLabel').textContent=`Página ${state.pages.length?state.page+1:0} / ${state.pages.length}`;$('prevPage').disabled=state.page<=0;$('nextPage').disabled=state.page>=state.pages.length-1}$('downloadPng').addEventListener('click',downloadPng);$('downloadPdf').addEventListener('click',downloadPdf);
 function syncSelectedZoomDisplay(){
  const row=$('fileList').children[state.selectedIndex];
  if(!row)return;
  const value=Math.round(itemValue(state.items[state.selectedIndex],'zoom')*100);
  const button=row.querySelector('.zoom-value');
  const slider=row.querySelector('.zoom-control input[type="range"]');
  const readout=row.querySelector('.zoom-control span');
  if(button)button.textContent=value+'%';
  if(slider)slider.value=value;
  if(readout)readout.textContent=value+'%';
 }
 document.addEventListener('keydown',e=>{
  if(state.selectedIndex<0||!state.items[state.selectedIndex])return;
  // Não intercepta teclas enquanto o usuário estiver digitando em campos.
  if(e.target.matches('input,textarea,select,[contenteditable="true"]'))return;
  const item=state.items[state.selectedIndex];
  const moveBy=2;
  let moved=false;
  if(e.key==='ArrowLeft'){setItemValue(item,'panX',Math.max(-50,Math.min(50,itemValue(item,'panX')-moveBy)));moved=true;}
  else if(e.key==='ArrowRight'){setItemValue(item,'panX',Math.max(-50,Math.min(50,itemValue(item,'panX')+moveBy)));moved=true;}
  else if(e.key==='ArrowUp'){setItemValue(item,'panY',Math.max(-50,Math.min(50,itemValue(item,'panY')-moveBy)));moved=true;}
  else if(e.key==='ArrowDown'){setItemValue(item,'panY',Math.max(-50,Math.min(50,itemValue(item,'panY')+moveBy)));moved=true;}
  else if(e.key==='+'||e.key==='='||e.key==='Add'){e.preventDefault();setItemValue(item,'zoom',Math.min(3,Math.round((itemValue(item,'zoom')+.1)*100)/100));updatePreviewOnly();syncSelectedZoomDisplay();return;}
  else if(e.key==='-'||e.key==='_'||e.key==='Subtract'){e.preventDefault();setItemValue(item,'zoom',Math.max(.5,Math.round((itemValue(item,'zoom')-.1)*100)/100));updatePreviewOnly();syncSelectedZoomDisplay();return;}
  if(moved){e.preventDefault();updatePreviewOnly();}
 });
 const dz=$('dropzone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover')}));dz.addEventListener('drop',e=>loadFiles(e.dataTransfer.files));
 update();
})();
