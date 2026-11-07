(() => {
  const $ = id => document.getElementById(id);
  const paperSizes = { A4:[21,29.7], A3:[29.7,42], SRA3:[32,45] };
  const presets = [[10,15],[9,13],[8,12],[7,10],[6,9],[5,7]];
  const state = { paper:"A4", images:[], layout:null, busy:false };
  const canvas = $("previewCanvas"), ctx = canvas.getContext("2d");

  function setStatus(message){ $("status").textContent = message; }
  function cmText(n){ return (Math.round(n*100)/100).toLocaleString("pt-BR",{maximumFractionDigits:2})+" cm"; }
  function totalCopies(){ return state.images.length * Math.max(1,Math.min(500,parseInt($("copies").value,10)||1)); }

  function chooseLayout(){
    const count = totalCopies();
    if(!count) return null;
    const cut = $("cutLines").checked;
    const gap = cut ? 0 : 0.5;
    const margin = 1;
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
      if(cover){
        const s=Math.max(cellW/iw,cellH/ih), sw=cellW/s, sh=cellH/s;
        c.drawImage(item.image,(iw-sw)/2,(ih-sh)/2,sw,sh,x,y,cellW,cellH);
      }else{
        const s=Math.min(cellW/iw,cellH/ih), dw=iw*s, dh=ih*s;
        c.drawImage(item.image,x+(cellW-dw)/2,y+(cellH-dh)/2,dw,dh);
      }
      c.restore();
    });
    if($("cutLines").checked){
      c.save(); c.strokeStyle="#D2D3D5"; c.lineWidth=Math.max(1,0.12*scale);
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
    $("sizeInfo").textContent=`Imagem: ${cmText(layout.cellW)} × ${cmText(layout.cellH)} • ${totalCopies()} unidades`;
    $("download").disabled=false;
    const mode=$("cutLines").checked?"linha de corte":"espaçamento de 0,5 cm";
    setStatus(`${totalCopies()} imagens • margem de 1 cm • ${mode}`);
  }

  function renderFileList(){
    const list=$("fileList");list.innerHTML="";
    state.images.forEach((item,index)=>{
      const row=document.createElement("div");row.className="file-item";
      const img=document.createElement("img");img.src=item.url;img.alt="";
      const name=document.createElement("span");name.className="file-name";name.textContent=item.file.name;
      const remove=document.createElement("button");remove.className="remove-file";remove.type="button";remove.textContent="×";remove.title="Remover imagem";
      remove.addEventListener("click",()=>{URL.revokeObjectURL(item.url);state.images.splice(index,1);renderFileList();updatePreview();});
      row.append(img,name,remove);list.append(row);
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
        state.images.push({file,url,image});
      }catch(e){URL.revokeObjectURL(url);}
    }
    renderFileList();updatePreview();
  }

  $("fileInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  ["copies","fit","cutLines"].forEach(id=>$(id).addEventListener("input",updatePreview));
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