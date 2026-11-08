(() => {
  const $ = id => document.getElementById(id);
  const paperSizes = { A4:[21,29.7], A3:[29.7,42], SRA3:[32,45], "10x15":[10,15] };
  const presets = [[10,15],[9,13],[8,12],[7,10],[6,9],[5,7]];
  const state = { paper:"A4", images:[], layout:null, busy:false };
  const canvas = $("previewCanvas"), ctx = canvas.getContext("2d");

  function setStatus(message, warning=false){ $("status").textContent = message; $("status").classList.toggle("warning",warning); }
  function cmText(n){ return (Math.round(n*100)/100).toLocaleString("pt-BR",{maximumFractionDigits:2})+" cm"; }
  function totalCopies(){ return state.images.length * Math.max(1,Math.min(500,parseInt($("copies").value,10)||1)); }

  function chooseGridLayout(){
    const count = totalCopies();
    if(!count) return null;
    const cut = $("cutLines").checked;
    const gap = cut ? 0 : 0.5;
    const margin = state.paper === "10x15" ? 0.2 : 1;
    const customItems = state.images.filter(item => item.customW > 0 && item.customH > 0);
    if(customItems.length){
      const baseW=Math.max(...customItems.map(i=>i.customW));
      const baseH=Math.max(...customItems.map(i=>i.customH));
      const [pw0,ph0]=paperSizes[state.paper];
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
    const [pw,ph] = paperSizes[state.paper];
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
    // MaxRects: mantém vários espaços livres e escolhe a melhor posição para cada peça.
    let free=[{x:0,y:0,w:areaW+gap,h:areaH+gap}];
    const placed=[];
    for(const rect of rectangles){
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
      if(best<0) continue;
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
    return placed;
  }

  function chooseLayout(){
    if(!$("smartFill").checked) return chooseGridLayout();

    const [pw,ph]=paperSizes[state.paper];
    const margin=state.paper==="10x15"?0.2:0.7;
    const gap=$("cutLines").checked?0:0.2;
    const copies=Math.max(1,Math.min(500,parseInt($("copies").value,10)||1));

    // No aproveitamento inteligente, a altura informada controla o tamanho;
    // a largura é sempre calculada pela proporção original do arquivo.
    const dimensions=state.images.map(item=>{
      const h=item.customH>0?item.customH:(chooseGridLayout()?.cellH||7);
      const ratio=item.image.naturalWidth/Math.max(1,item.image.naturalHeight);
      return {item,w:h*ratio,h};
    }).filter(d=>d.w>0&&d.h>0);
    if(!dimensions.length) return null;

    const options=[];
    for(const orientation of ["portrait","landscape"]){
      const sw=orientation==="portrait"?pw:ph;
      const sh=orientation==="portrait"?ph:pw;
      const areaW=sw-2*margin, areaH=sh-2*margin;
      // Usa a mesma quantidade de colunas em todas as fileiras. Isso evita
      // que uma imagem pequena tome a folha inteira e deixe outra de fora.
      const cols=Math.min(...dimensions.map(d=>Math.floor((areaW+gap)/(d.w+gap))));
      if(cols<1) continue;
      // Reserva fileiras para cada arquivo, em blocos iguais, como na montagem manual.
      const oneCycleH=dimensions.reduce((sum,d)=>sum+d.h,0)+dimensions.length*gap;
      const rows=Math.floor((areaH+gap)/oneCycleH);
      if(rows<1) continue;
      const totalRows=rows*dimensions.length;
      const totalH=rows*dimensions.reduce((sum,d)=>sum+d.h,0)+(totalRows-1)*gap;
      const placements=[];
      let y=(areaH-totalH)/2+margin;
      for(const d of dimensions){
        const rowW=cols*d.w+(cols-1)*gap;
        const x=(sw-rowW)/2;
        for(let r=0;r<rows;r++){
          for(let c=0;c<cols;c++){
            placements.push({item:d.item,x:x+c*(d.w+gap),y,w:d.w,h:d.h});
          }
          y+=d.h+gap;
        }
      }
      options.push({orientation,sw,sh,margin,gap,placements,
        capacity:placements.length,smart:true,rows,cols,requested:dimensions.length*copies});
    }
    if(!options.length){
      // Se as dimensões não couberem nem uma vez, ainda mostra a primeira
      // imagem em tamanho solicitado e impede qualquer falsa indicação de capacidade.
      return {orientation:"portrait",sw:pw,sh:ph,margin,gap,placements:[],capacity:0,smart:true,overflow:true};
    }
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

  function drawSheet(targetCanvas, layout, forExport){
    const [pw,ph]=paperSizes[state.paper];
    const sheetW=layout.orientation==="portrait"?pw:ph;
    const sheetH=layout.orientation==="portrait"?ph:pw;
    const dpi=forExport?300:72;
    const scale=dpi/2.54;
    targetCanvas.width=Math.round(sheetW*scale);
    targetCanvas.height=Math.round(sheetH*scale);
    const c=targetCanvas.getContext("2d");
    c.fillStyle="#ffffff"; c.fillRect(0,0,targetCanvas.width,targetCanvas.height);
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
      c.beginPath(); c.rect(x,y,cellW,cellH); c.clip();
      const iw=item.image.naturalWidth, ih=item.image.naturalHeight;
      const cover=$("fit").checked;
      const targetW=item.customW>0&&item.customH>0?item.customW*scale:cellW;
      const targetH=item.customW>0&&item.customH>0?item.customH*scale:cellH;
      const dx=x+(cellW-targetW)/2, dy=y+(cellH-targetH)/2;
      if(cover){
        const s=Math.max(targetW/iw,targetH/ih), sw=targetW/s, sh=targetH/s;
        c.drawImage(item.image,(iw-sw)/2,(ih-sh)/2,sw,sh,dx,dy,targetW,targetH);
      }else{
        const s=Math.min(targetW/iw,targetH/ih), dw=iw*s, dh=ih*s;
        c.drawImage(item.image,dx+(targetW-dw)/2,dy+(targetH-dh)/2,dw,dh);
      }
      c.restore();
    });
    if($("cutLines").checked){
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
      $("sizeInfo").textContent="Aguardando imagens";$("paperInfo").textContent=state.paper;
      $("download").disabled=true;return;
    }
    const layout=chooseLayout(); state.layout=layout;
    if(!layout){setStatus("Não foi possível calcular a montagem.");return;}
    drawSheet(canvas,layout,false);
    canvas.style.display="block";$("emptyState").style.display="none";
    const orient=layout.orientation==="portrait"?"Retrato":"Paisagem";
    $("paperInfo").textContent=`${state.paper} • ${orient}`;
    if(layout.smart){
      const counts=state.images.map(item=>`${item.file.name}: ${layout.placements.filter(p=>p.item===item).length}`).join(" • ");
      $("sizeInfo").textContent=`${layout.capacity} unidades aproveitadas`;
      setStatus(`${counts} • aproveitamento inteligente`);
    }else{
      $("sizeInfo").textContent=`Imagem: ${cmText(layout.cellW)} × ${cmText(layout.cellH)} • ${totalCopies()} unidades`;
    }
    const mode=layout.smart?"aproveitamento inteligente":($("cutLines").checked?"linha de corte":"espaçamento de 0,5 cm");
    const margin=state.paper==="10x15"?"0,2 cm":(layout.smart?"0,7 cm":"1 cm");
    const custom=state.images.some(i=>i.customW>0&&i.customH>0);
    const over=custom && (layout.overflow || totalCopies()>layout.capacity);
    $("download").disabled=!!over;
    if(layout.smart){
      $("download").disabled=false;
    }else if(over){
      setStatus(`Quantidade máxima: ${layout.capacity} imagens neste tamanho. Reduza a quantidade ou as dimensões.`,true);
    }else if(!layout.smart){
      setStatus(`${totalCopies()} imagens • margem de ${margin} • ${mode}`);
    }
  }

  function renderFileList(){
    const list=$("fileList");list.innerHTML="";
    state.images.forEach((item,index)=>{
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
      remove.addEventListener("click",()=>{URL.revokeObjectURL(item.url);state.images.splice(index,1);renderFileList();updatePreview();});
      row.append(img,meta,remove);list.append(row);
    });
  }

  async function addFiles(files){
    const valid=[...files].filter(f=>/^image\/(png|jpeg)$/.test(f.type));
    if(!valid.length){setStatus("Selecione arquivos PNG ou JPEG.");return;}
    for(const file of valid){
      const url=URL.createObjectURL(file);
      try{
        const image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
        state.images.push({file,url,image,customW:0,customH:0});
      }catch(e){URL.revokeObjectURL(url);}
    }
    renderFileList();updatePreview();
  }

  $("fileInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  ["copies","fit","cutLines"].forEach(id=>$(id).addEventListener("input",updatePreview));
  $("smartFill").addEventListener("change",updatePreview);
  $("smartFill").addEventListener("input",updatePreview);
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
      const output=document.createElement("canvas");drawSheet(output,state.layout,true);
      const format=$("format").value;
      output.toBlob(blob=>{
        if(!blob){setStatus("Não foi possível gerar o arquivo. Tente usar PNG ou reduzir a quantidade de imagens.");btn.disabled=false;return;}
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