(() => {
  const $ = id => document.getElementById(id);
  const paperSizes = { A4:[21,29.7], A3:[29.7,42], SRA3:[32,45], "10x15":[10,15] };
  function sheetDimensions(){
    if(state.paper==="CXSÓ") return totalCopies()<=12 ? paperSizes.A4 : paperSizes.SRA3;
    return paperSizes[state.paper];
  }
  function effectiveItemSize(item){
    const groupHeight=$("adjustGroups")?.checked ? state.groupHeights[item.group] : 0;
    if(groupHeight>0){
      const ratio=item.image.naturalWidth/Math.max(1,item.image.naturalHeight);
      return {w:groupHeight*ratio,h:groupHeight};
    }
    return {w:item.customW||0,h:item.customH||0};
  }
  const presets = [[10,15],[9,13],[8,12],[7,10],[6,9],[5,7]];
  const state = { paper:"A4", images:[], layout:null, busy:false, nextGroup:1, groupHeights:{} };
  const canvas = $("previewCanvas"), ctx = canvas.getContext("2d");

  function setStatus(message, warning=false){ $("status").textContent = message; $("status").classList.toggle("warning",warning); }
  function cmText(n){ return (Math.round(n*100)/100).toLocaleString("pt-BR",{maximumFractionDigits:2})+" cm"; }
  function totalCopies(){ return state.images.length * Math.max(1,Math.min(500,parseInt($("copies").value,10)||1)); }

  function chooseGridLayout(){
    const count = totalCopies();
    if(!count) return null;
    if(state.paper==="CXSÓ"){
      const isA4=count<=12;
      const [pw,ph]=isA4?paperSizes.A4:paperSizes.SRA3;
      const orientation=isA4?"portrait":"landscape";
      return {orientation,sw:isA4?pw:ph,sh:isA4?ph:pw,cols:isA4?3:7,rows:4,
        cellW:5,cellH:7,gap:0.1,margin:0.5,cxo:true,capacity:isA4?12:28,overflow:count>28};
    }
    const cut = $("cutLines").checked;
    const gap = cut ? 0 : 0.5;
    const margin = state.paper === "10x15" ? 0.2 : (state.paper==="CXSÓ"?0.5:1);
    const customItems = state.images.filter(item => {
      const size=effectiveItemSize(item); return size.w>0 && size.h>0;
    });
    if(customItems.length){
      const baseW=Math.max(...customItems.map(i=>effectiveItemSize(i).w));
      const baseH=Math.max(...customItems.map(i=>effectiveItemSize(i).h));
      const [pw0,ph0]=sheetDimensions();
      const options=[];
      for(const orientation of ["portrait","landscape"]){
        const sw=orientation==="portrait"?pw0:ph0, sh=orientation==="portrait"?ph0:pw0;
        const aw=sw-2*margin, ah=sh-2*margin;
        for(let cols=1;cols<=count;cols++){
          const rows=Math.ceil(count/cols), cellW=baseW, cellH=baseH;
          const usedW=cols*cellW+(cols-1)*gap, usedH=rows*cellH+(rows-1)*gap;
          if(usedW<=aw+1e-6 && usedH<=ah+1e-6) options.push({orientation,sw,sh,cols,rows,cellW,cellH,gap,margin,custom:true,capacity:cols*Math.floor((ah+gap)/(cellH+gap))});
        }
      }
      if(!options.length){
        // Keep a layout for previewing the requested size; the capacity warning disables download.
        const orientation=pw0<=ph0?"portrait":"landscape";
        const sw=orientation==="portrait"?pw0:ph0, sh=orientation==="portrait"?ph0:pw0;
        const cols=Math.max(1,Math.floor((sw-2*margin+gap)/(baseW+gap)));
        const rows=Math.max(1,Math.floor((sh-2*margin+gap)/(baseH+gap)));
        return {orientation,sw,sh,cols,rows,cellW:baseW,cellH:baseH,gap,margin,custom:true,capacity:cols*rows,overflow:true};
      }
      options.sort((a,b)=>(b.cellW*b.cellH-a.cellW*a.cellH)||(b.capacity-a.capacity));
      const best=options[0];
      best.capacity=best.cols*Math.floor(((best.sh-2*margin)+gap)/(best.cellH+gap));
      return best;
    }
    const [pw,ph] = sheetDimensions();
    const candidates = [];
    for(const orientation of ["portrait","landscape"]){
      const sw = orientation==="portrait" ? pw : ph;
      const sh = orientation==="portrait" ? ph : pw;
      const aw=sw-2*margin, ah=sh-2*margin;
      for(const preset of presets){
        const [baseW,baseH] = $("fit").checked ? [preset[0],preset[0]] : preset;
        for(let cols=1;cols<=count;cols++){
          const rows=Math.ceil(count/cols);
          const maxW=(aw-gap*(cols-1))/cols;
          const maxH=(ah-gap*(rows-1))/rows;
          const fitScale=Math.min(maxW/baseW,maxH/baseH);
          const scale=Math.min(1,fitScale);
          if(fitScale>0) candidates.push({orientation,sw,sh,cols,rows,cellW:baseW*scale,cellH:baseH*scale,scale:fitScale,baseW,baseH,gap,margin,preset:preset.join("x"),isPreset:fitScale>=0.999999});
        }
      }
    }
    // Use the largest available commercial preset that fits; otherwise use the largest proportional fallback.
    for(const p of presets){
      const found=candidates.filter(c=>c.preset===p.join("x") && c.scale>=0.999999)
        .sort((a,b)=>(b.cellW*b.cellH-a.cellW*a.cellH) || (a.rows*a.cols-b.rows*b.cols))[0];
      if(found) return found;
    }
    candidates.sort((a,b)=>(b.cellW*b.cellH-a.cellW*a.cellH) || (a.rows*a.cols-b.rows*b.cols));
    return candidates[0] || null;
  }

  function packRectangles(rectangles, areaW, areaH, gap){
    // MaxRects: posiciona peças de tamanhos diferentes e conserva os espaços livres.
    let free=[{x:0,y:0,w:areaW+gap,h:areaH+gap}];
    const placed=[];
    const ordered=[...rectangles].sort((a,b)=>(b.w*b.h-a.w*a.h)||(b.h-a.h));
    for(const rect of ordered){
      const rw=rect.w+gap, rh=rect.h+gap;
      let best=-1, bestScore=Infinity, bestX=0, bestY=0;
      for(let i=0;i<free.length;i++){
        const f=free[i];
        if(rw<=f.w+1e-7 && rh<=f.h+1e-7){
          const leftoverW=f.w-rw, leftoverH=f.h-rh;
          const score=Math.min(leftoverW,leftoverH)*10000+Math.max(leftoverW,leftoverH);
          if(score<bestScore){best=i;bestScore=score;bestX=f.x;bestY=f.y;}
        }
      }
      if(best<0) return null;
      placed.push({item:rect.item,x:bestX,y:bestY,w:rect.w,h:rect.h});
      const used={x:bestX,y:bestY,w:rw,h:rh};
      const next=[];
      for(const f of free){
        const intersects=used.x<f.x+f.w-1e-7 && used.x+used.w>f.x+1e-7 && used.y<f.y+f.h-1e-7 && used.y+used.h>f.y+1e-7;
        if(!intersects){next.push(f);continue;}
        if(used.x>f.x+1e-7) next.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
        if(used.x+used.w<f.x+f.w-1e-7) next.push({x:used.x+used.w,y:f.y,w:f.x+f.w-(used.x+used.w),h:f.h});
        if(used.y>f.y+1e-7) next.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
        if(used.y+used.h<f.y+f.h-1e-7) next.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-(used.y+used.h)});
      }
      free=next.filter((r,i,arr)=>r.w>1e-7&&r.h>1e-7&&!arr.some((q,j)=>j!==i&&q.x<=r.x+1e-7&&q.y<=r.y+1e-7&&q.x+q.w>=r.x+r.w-1e-7&&q.y+q.h>=r.y+r.h-1e-7));
    }
    return {placed,free};
  }

  function chooseLayout(){
    if(state.paper==="CXSÓ") return chooseGridLayout();
    if(!$('smartFill').checked) return chooseGridLayout();

    const [pw,ph]=sheetDimensions();
    const margin=state.paper==='10x15'?0.2:0.7;
    const gap=$('cutLines').checked?0:0.2;

    // Cada cópia solicitada entra uma única vez no aproveitamento.
    // A dimensão é calculada individualmente, respeitando a altura do grupo.
    const dimensions=makeOrderedCopies().map(item=>{
      const ratio=item.image.naturalWidth/Math.max(1,item.image.naturalHeight);
      const groupSize=effectiveItemSize(item);
      const h=groupSize.h>0?groupSize.h:7;
      const w=groupSize.w>0?groupSize.w:h*ratio;
      return {item,w,h};
    }).filter(d=>d.w>0&&d.h>0);

    if(!dimensions.length) return null;

    const options=[];
    for(const orientation of ['portrait','landscape']){
      const sw=orientation==='portrait'?pw:ph;
      const sh=orientation==='portrait'?ph:pw;
      const areaW=sw-2*margin, areaH=sh-2*margin;
      if(dimensions.some(d=>d.w>areaW+1e-7||d.h>areaH+1e-7)) continue;

      const placements=[];
      let y=0, index=0;
      while(index<dimensions.length){
        let x=0, rowH=0;
        const row=[];
        // Coloca cada item da lista uma única vez. Quando não couber,
        // encerra a fileira e tenta a próxima sem repetir imagens.
        while(index<dimensions.length){
          const d=dimensions[index];
          const neededW=(row.length?gap:0)+d.w;
          if(x+neededW>areaW+1e-7) break;
          row.push({item:d.item,x:x+neededW-(row.length?0:d.w),w:d.w,h:d.h});
          x+=neededW;
          rowH=Math.max(rowH,d.h);
          index++;
        }
        if(!row.length) break;
        if(y+rowH>areaH+1e-7) break;

        const rowW=x;
        const offsetX=(areaW-rowW)/2;
        row.forEach(p=>placements.push({
          item:p.item,
          x:margin+offsetX+p.x,
          y:margin+y+(rowH-p.h)/2,
          w:p.w,
          h:p.h
        }));
        y+=rowH+gap;
      }

      if(!placements.length) continue;
      const occupiedH=y-gap;
      const offsetY=Math.max(0,(areaH-occupiedH)/2);
      if(offsetY>0) placements.forEach(p=>p.y+=offsetY);

      options.push({
        orientation,sw,sh,margin,gap,placements,
        capacity:placements.length,
        smart:true,
        requested:dimensions.length,
        overflow:placements.length<dimensions.length
      });
    }

    if(!options.length){
      return {
        orientation:'portrait',sw:pw,sh:ph,margin,gap,
        placements:[],capacity:0,smart:true,overflow:true,
        requested:dimensions.length
      };
    }
    // Prioriza a maior quantidade de cópias colocadas; em empate,
    // escolhe a orientação com melhor aproveitamento da área.
    options.sort((a,b)=>b.capacity-a.capacity);
    return options[0];
  }

  function makeOrderedCopies(){
    const copies=Math.max(1,Math.min(500,parseInt($("copies").value,10)||1));
    const arr=[];
    for(const item of state.images) for(let i=0;i<copies;i++) arr.push(item);
    return arr;
  }

  function drawImageCoverOrContain(image,x,y,w,h,cover){
    const iw=image.naturalWidth, ih=image.naturalHeight;
    if(cover){
      const scale=Math.max(w/iw,h/ih), sw=w/scale, sh=h/scale;
      const sx=(iw-sw)/2, sy=(ih-sh)/2;
      ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);
    } else {
      const scale=Math.min(w/iw,h/ih), dw=iw*scale, dh=ih*scale;
      ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
    }
  }

  function drawSheet(targetCanvas, layout, forExport, transparent=false){
    const [pw,ph]=sheetDimensions();
    const sheetW=layout.orientation==="portrait"?pw:ph;
    const sheetH=layout.orientation==="portrait"?ph:pw;
    const dpi=forExport?300:72;
    const scale=dpi/2.54;
    targetCanvas.width=Math.round(sheetW*scale);
    targetCanvas.height=Math.round(sheetH*scale);
    const c=targetCanvas.getContext("2d");
    if(!transparent){c.fillStyle="#ffffff"; c.fillRect(0,0,targetCanvas.width,targetCanvas.height);}
    const images=makeOrderedCopies();
    if(layout.smart){
      layout.placements.forEach(p=>{
        const x=p.x*scale,y=p.y*scale,w=p.w*scale,h=p.h*scale;
        c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
        const iw=p.item.image.naturalWidth,ih=p.item.image.naturalHeight;
        const cover=$("fit").checked;
        if(cover){const s=Math.max(w/iw,h/ih),sw= w/s,sh=h/s;c.drawImage(p.item.image,(iw-sw)/2,(ih-sh)/2,sw,sh,x,y,w,h);}
        else{const s=Math.min(w/iw,h/ih),dw=iw*s,dh=ih*s;c.drawImage(p.item.image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
        c.restore();
      });
      if($("cutLines").checked){
        c.save();c.strokeStyle="#D2D3D5";c.lineWidth=Math.max(forExport?0.5:1,0.02*scale);
        layout.placements.forEach(p=>{const x=p.x*scale,y=p.y*scale,w=p.w*scale,h=p.h*scale;c.strokeRect(x,y,w,h);});
        c.restore();
      }
      return;
    }
    const x0=layout.margin*scale, y0=layout.margin*scale;
    const cellW=layout.cellW*scale, cellH=layout.cellH*scale, gap=layout.gap*scale;
    const gridW=layout.cols*cellW+(layout.cols-1)*gap;
    const gridH=layout.rows*cellH+(layout.rows-1)*gap;
    const startX=x0+((sheetW-2*layout.margin)*scale-gridW)/2;
    const startY=y0+((sheetH-2*layout.margin)*scale-gridH)/2;
    images.forEach((item,i)=>{
      const col=i%layout.cols, row=Math.floor(i/layout.cols);
      const x=startX+col*(cellW+gap), y=startY+row*(cellH+gap);
      c.save();
      c.beginPath();
      if(layout.cxo){
        const r=cellW/2;
        c.moveTo(x,y+r); c.lineTo(x,y+cellH); c.lineTo(x+cellW,y+cellH);
        c.lineTo(x+cellW,y+r); c.arc(x+r,y+r,r,0,Math.PI,true);
      }else c.rect(x,y,cellW,cellH);
      c.closePath(); c.clip();
      const iw=item.image.naturalWidth, ih=item.image.naturalHeight;
      const cover=$("fit").checked;
      const itemSize=effectiveItemSize(item);
      const targetW=itemSize.w>0&&itemSize.h>0?itemSize.w*scale:cellW;
      const targetH=itemSize.w>0&&itemSize.h>0?itemSize.h*scale:cellH;
      const dx=x+(cellW-targetW)/2, dy=y+(cellH-targetH)/2;
      if(cover){
        const s=Math.max(targetW/iw,targetH/ih), sw=targetW/s, sh=targetH/s;
        c.drawImage(item.image,(iw-sw)/2,(ih-sh)/2,sw,sh,dx,dy,targetW,targetH);
      }else{
        const s=Math.min(targetW/iw,targetH/ih), dw=iw*s, dh=ih*s;
        c.drawImage(item.image,dx+(targetW-dw)/2,dy+(targetH-dh)/2,dw,dh);
      }
      c.restore();
      if(layout.cxo && $("cutLines").checked){
        c.save(); c.beginPath();
        const r=cellW/2;
        c.moveTo(x,y+r); c.lineTo(x,y+cellH); c.lineTo(x+cellW,y+cellH);
        c.lineTo(x+cellW,y+r); c.arc(x+r,y+r,r,0,Math.PI,true); c.closePath();
        c.strokeStyle="#D2D3D5"; c.lineWidth=Math.max(forExport?0.5:1,0.02*scale); c.stroke(); c.restore();
      }
    });
    if($("cutLines").checked && !layout.cxo){
      c.save(); c.strokeStyle="#D2D3D5"; c.lineWidth=Math.max(forExport?0.5:1,0.02*scale);
      // Fine internal cut guides, only between occupied cells.
      for(let col=1;col<layout.cols;col++){
        const x=startX+col*cellW+(col-1)*gap+gap/2;
        c.beginPath();c.moveTo(x,startY);c.lineTo(x,startY+gridH);c.stroke();
      }
      for(let row=1;row<layout.rows;row++){
        const y=startY+row*cellH+(row-1)*gap+gap/2;
        c.beginPath();c.moveTo(startX,y);c.lineTo(startX+gridW,y);c.stroke();
      }
      c.restore();
    }
  }

  function updatePreview(){
    if(!state.images.length){
      canvas.style.display="none";$("emptyState").style.display="flex";
      $("sizeInfo").textContent="";$("paperInfo").textContent=state.paper;
      $("download").disabled=true;return;
    }
    const layout=chooseLayout(); state.layout=layout;
    if(!layout){setStatus("Não foi possível calcular a montagem.");return;}
    drawSheet(canvas,layout,false);
    canvas.style.display="block";$("emptyState").style.display="none";
    const orient=layout.orientation==="portrait"?"Retrato":"Paisagem";
    $("paperInfo").textContent=`${state.paper==="CXSÓ"?(layout.sw===21?"A4":"SRA3")+" • CXSÓ":state.paper} • ${orient}`;
    if(layout.smart){
      const counts=state.images.map(item=>`${item.file.name}: ${layout.placements.filter(p=>p.item===item).length}`).join(" • ");
      $("sizeInfo").textContent=`${layout.capacity} unidades aproveitadas`;
      setStatus(`${counts} • aproveitamento inteligente`);
    }else{
      $("sizeInfo").textContent=layout.cxo
        ? `CXSÓ 5 × 7 cm • ${totalCopies()} de ${layout.capacity} peças`
        : `Imagem: ${cmText(layout.cellW)} × ${cmText(layout.cellH)} • ${totalCopies()} unidades`;
    }
    const mode=layout.smart?"aproveitamento inteligente":($("cutLines").checked?"linha de corte":"espaçamento de 0,5 cm");
    const margin=state.paper==="10x15"?"0,2 cm":(state.paper==="CXSÓ"?"0,5 cm":(layout.smart?"0,7 cm":"1 cm"));
    const custom=state.images.some(i=>i.customW>0&&i.customH>0);
    const over=(custom && (layout.overflow || totalCopies()>layout.capacity)) || (state.paper==="CXSÓ" && totalCopies()>28);
    $("download").disabled=!!over;
    if(layout.smart){
      $("download").disabled=false;
    }else if(state.paper==="CXSÓ" && totalCopies()<=28){
      setStatus(`${totalCopies()} peças • ${layout.sw===21?"A4":"SRA3"} • CXSÓ`);
    }else if(over){
      setStatus(`Quantidade máxima: ${layout.capacity} imagens neste tamanho. Reduza a quantidade ou as dimensões.`,true);
    }else if(!layout.smart){
      setStatus(`${totalCopies()} imagens • margem de ${margin} • ${mode}`);
    }
  }

  function renderFileList(){
    const list=$("fileList");list.innerHTML="";
    let lastGroup=0;
    state.images.forEach((item,index)=>{
      if(item.group!==lastGroup){
        const heading=document.createElement("div");heading.className="file-group-title";
        const title=document.createElement("strong");title.textContent=`GRUPO ${item.group}`;
        heading.append(title);
        if($("adjustGroups").checked){
          const sizeLabel=document.createElement("label");sizeLabel.className="file-group-size";
          sizeLabel.textContent="Altura:";
          const sizeInput=document.createElement("input");
          sizeInput.type="number";sizeInput.min="0.1";sizeInput.max="100";sizeInput.step="0.1";
          sizeInput.placeholder="cm";sizeInput.value=state.groupHeights[item.group]||"";
          sizeInput.setAttribute("aria-label",`Altura de todas as imagens do grupo ${item.group}`);
          sizeInput.addEventListener("change",()=>{
            state.groupHeights[item.group]=parseFloat(sizeInput.value)>0?parseFloat(sizeInput.value):0;
            updatePreview();
          });
          const unit=document.createElement("small");unit.textContent="cm";
          sizeLabel.append(sizeInput,unit);heading.append(sizeLabel);
        }
        list.append(heading);lastGroup=item.group;
      }
      const row=document.createElement("div");row.className="file-item";
      const img=document.createElement("img");img.src=item.url;img.alt="";
      const meta=document.createElement("div");meta.className="file-meta";
      const name=document.createElement("span");name.className="file-name";name.textContent=item.file.name;
      const sizes=document.createElement("div");sizes.className="custom-size";
      const w=document.createElement("input");w.type="number";w.min="0.1";w.max="100";w.step="0.1";w.placeholder="L cm";w.value=item.customW||"";w.setAttribute("aria-label",`Largura personalizada da imagem ${item.file.name}`);
      const h=document.createElement("input");h.type="number";h.min="0.1";h.max="100";h.step="0.1";h.placeholder="A cm";h.value=item.customH||"";h.setAttribute("aria-label",`Altura personalizada da imagem ${item.file.name}`);
      const unit=document.createElement("em");unit.textContent="cm";
      const apply=()=>{item.customW=parseFloat(w.value)>0?parseFloat(w.value):0;item.customH=parseFloat(h.value)>0?parseFloat(h.value):0;updatePreview();};
      w.addEventListener("change",apply);h.addEventListener("change",apply);
      sizes.append(w,document.createTextNode("×"),h,unit);
      meta.append(name,sizes);
      const remove=document.createElement("button");remove.className="remove-file";remove.type="button";remove.textContent="×";remove.title="Remover imagem";
      remove.addEventListener("click",()=>{URL.revokeObjectURL(item.url);state.images.splice(index,1);
        const remainingGroups=[...new Set(state.images.map(item=>item.group))];
        state.nextGroup=remainingGroups.length?Math.max(...remainingGroups)+1:1;
        renderFileList();renderGroupHeights();updatePreview();});
      row.append(img,meta,remove);list.append(row);
    });
  }

  async function addFiles(files){
    const valid=[...files].filter(f=>/^image\/(png|jpeg)$/.test(f.type));
    if(!valid.length){setStatus("Selecione arquivos PNG ou JPEG.");return;}
    const group=state.nextGroup;
    if(group>3){setStatus("Limite de 3 grupos atingido. Remova as imagens de um grupo antes de adicionar outro.",true);return;}
    let added=0;
    for(const file of valid){
      const url=URL.createObjectURL(file);
      try{
        const image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
        state.images.push({file,url,image,customW:0,customH:0,group}); added++;
      }catch(e){URL.revokeObjectURL(url);}
    }
    if(added) state.nextGroup=Math.min(4,group+1);
    renderFileList();renderGroupHeights();updatePreview();
  }

  function renderGroupHeights(){
    renderFileList();
  }

  $("fileInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  ["copies","fit","cutLines"].forEach(id=>$(id).addEventListener("input",updatePreview));
  $("smartFill").addEventListener("change",updatePreview);
  $("smartFill").addEventListener("input",updatePreview);
  $("adjustGroups").addEventListener("change",()=>{renderGroupHeights();updatePreview();});
  document.querySelectorAll(".paper-tab").forEach(btn=>btn.addEventListener("click",()=>{
    state.paper=btn.dataset.paper;
    document.querySelectorAll(".paper-tab").forEach(b=>b.classList.toggle("active",b===btn));
    updatePreview();
  }));
  const drop=$("dropzone");
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("dragover");}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("dragover");}));
  drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));

  $("download").addEventListener("click",()=>{
    if(!state.images.length||!state.layout)return;
    const btn=$("download");btn.disabled=true;setStatus("Gerando arquivo em alta resolução…");
    try{
      const format=$("format").value;
      const output=document.createElement("canvas");
      drawSheet(output,state.layout,true,format==="png");

      if(format==="pdf"){
        if(!window.jspdf?.jsPDF){
          setStatus("Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.");
          btn.disabled=false;return;
        }
        const [pw,ph]=sheetDimensions();
        const sheetW=state.layout.orientation==="portrait"?pw:ph;
        const sheetH=state.layout.orientation==="portrait"?ph:pw;
        const {jsPDF}=window.jspdf;
        const pdf=new jsPDF({orientation:state.layout.orientation,unit:"mm",format:[sheetW*10,sheetH*10],compress:true});
        pdf.addImage(output.toDataURL("image/jpeg",0.98),"JPEG",0,0,sheetW*10,sheetH*10,undefined,"FAST");
        pdf.save(`paperpel-${state.paper.toLowerCase()}-300dpi.pdf`);
        setStatus("Arquivo PDF gerado em 300 DPI.");
        btn.disabled=false;
        return;
      }

      output.toBlob(blob=>{
        if(!blob){setStatus("Não foi possível gerar o arquivo. Tente reduzir a quantidade de imagens.");btn.disabled=false;return;}
        const a=document.createElement("a"),url=URL.createObjectURL(blob);
        a.href=url;a.download=`paperpel-${state.paper.toLowerCase()}-300dpi.${format==="png"?"png":"jpg"}`;
        document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
        setStatus(`Arquivo ${format.toUpperCase()} gerado em 300 DPI.`);
        btn.disabled=false;
      },format==="png"?"image/png":"image/jpeg",format==="jpeg"?0.98:undefined);
    }catch(err){console.error(err);setStatus("O navegador não conseguiu gerar o arquivo. Tente reduzir a quantidade de imagens.");btn.disabled=false;}
  });

  $("paperInfo").textContent="A4 • Retrato";
})();