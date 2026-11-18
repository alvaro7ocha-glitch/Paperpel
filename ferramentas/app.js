(() => {
  const $ = id => document.getElementById(id);
  const paperSizes = { A4:[21,29.7], A3:[29.7,42], SRA3:[32,45], "10x15":[10,15] };
  let pageItemsOverride=null;
  let pageCopiesOverride=null;
  function copiesCount(){ return pageCopiesOverride ?? Math.max(1,Math.min(500,parseInt($("copies").value,10)||1)); }
  function sheetDimensions(){
    if(state.paper==="CXSÓ") return totalCopies()<=12 ? paperSizes.A4 : paperSizes.SRA3;
    return paperSizes[state.paper];
  }
  function effectiveItemSize(item){
    const groupSize=state.groupSizes[item.group]||{};
    const ratio=item.image.naturalWidth/Math.max(1,item.image.naturalHeight);
    if($("adjustGroups")?.checked){
      // O campo proporcional define a altura; a largura acompanha a proporção original.
      if(groupSize.proportional>0){
        return {w:groupSize.proportional*ratio,h:groupSize.proportional,groupFrame:false};
      }
      // X e Y definem o quadro; a imagem será encaixada inteira dentro dele.
      if(groupSize.w>0&&groupSize.h>0){
        return {w:groupSize.w,h:groupSize.h,groupFrame:true};
      }
    }
    return {w:item.customW||0,h:item.customH||0,groupFrame:false};
  }

  const presets = [[10,15],[9,13],[8,12],[7,10],[6,9],[5,7]];
  const state = { manualPages:1, currentPage:0, pages:[], paper:"A4", images:[], layout:null, busy:false, nextGroup:1, groupSizes:{} };
  let selectedItem=null;
  function updateSelectedRows(){
    document.querySelectorAll(".file-item").forEach(row=>{
      const index=Number(row.dataset.imageIndex);
      row.classList.toggle("selected-image",state.images[index]===selectedItem);
    });
  }
  const canvas = $("previewCanvas"), ctx = canvas.getContext("2d");
  const sheetStage = canvas.closest(".sheet-stage");
  const emptyState = $("emptyState");
  const previewWrap = document.createElement("div");
  previewWrap.className = "preview-zoom-wrap";
  previewWrap.style.cssText = "display:inline-block;flex:0 0 auto;";
  sheetStage.insertBefore(previewWrap, emptyState);
  previewWrap.append(emptyState, canvas);
  let previewZoom = 1;
  previewWrap.style.zoom = String(previewZoom);
  const zoomReadout = document.createElement("div");
  zoomReadout.className = "preview-zoom-readout";
  zoomReadout.textContent = "Zoom 100%";
  sheetStage.appendChild(zoomReadout);
  sheetStage.addEventListener("wheel", event => {
    event.preventDefault();
    const previous = previewZoom;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    previewZoom = Math.max(0.25, Math.min(4, previewZoom * factor));
    if (previewZoom === previous) return;
    const rect = previewWrap.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    previewWrap.style.zoom = String(previewZoom);
    zoomReadout.textContent = `Zoom ${Math.round(previewZoom * 100)}%`;
    const ratio = previewZoom / previous;
    sheetStage.scrollLeft += anchorX * (ratio - 1);
    sheetStage.scrollTop += anchorY * (ratio - 1);
  }, { passive: false });

  function schedulePreview() {
    if (schedulePreview.pending) return;
    schedulePreview.pending = true;
    requestAnimationFrame(() => {
      schedulePreview.pending = false;
      updatePreview();
    });
  }

  function setStatus(message, warning=false){ $("status").textContent = message; $("status").classList.toggle("warning",warning); }
  function cmText(n){ return (Math.round(n*100)/100).toLocaleString("pt-BR",{maximumFractionDigits:2})+" cm"; }
  function totalCopies(){ return (pageItemsOverride ? pageItemsOverride.length : state.images.length * copiesCount()); }

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
    if(!$("smartFill").checked) return chooseGridLayout();

    const [pw,ph]=sheetDimensions();
    const margin=state.paper==="10x15"?0.2:0.7;
    const gap=$("cutLines").checked?0:0.2;
    const baseLayout=chooseGridLayout();
    if(!baseLayout || !state.images.length) return baseLayout;

    const copies=copiesCount();
    const groups=[...new Set(state.images.map(item=>item.group||1))].sort((a,b)=>a-b);
    const groupItems=groups.map(group=>({
      group,
      items:state.images.filter(item=>(item.group||1)===group).map(item=>{
        const ratio=item.image.naturalWidth/Math.max(1,item.image.naturalHeight);
        const chosen=effectiveItemSize(item);
        const h=chosen.h>0?chosen.h:(baseLayout.cellH||7);
        const w=chosen.w>0?chosen.w:h*ratio;
        return {item,w,h};
      }).filter(d=>d.w>0&&d.h>0)
    }));

    function makeRows(items,areaW){
      const ordered=[...items].sort((a,b)=>(b.w-a.w)||(b.h-a.h));
      const rows=[];
      let row=[],usedW=0,rowH=0;
      for(const d of ordered){
        if(d.w>areaW+1e-7) return null;
        const needed= row.length ? gap+d.w : d.w;
        if(row.length && usedW+needed>areaW+1e-7){
          rows.push({items:row,height:rowH});
          row=[];usedW=0;rowH=0;
        }
        const add=row.length?gap:0;
        row.push({...d,localX:usedW+add});
        usedW+=add+d.w;
        rowH=Math.max(rowH,d.h);
      }
      if(row.length) rows.push({items:row,height:rowH});
      return rows;
    }

    function rowsHeight(rows){
      return rows.reduce((sum,row)=>sum+row.height,0)+Math.max(0,rows.length-1)*gap;
    }

    function buildOrientation(orientation){
      const sw=orientation==="portrait"?pw:ph;
      const sh=orientation==="portrait"?ph:pw;
      const areaW=sw-2*margin,areaH=sh-2*margin;
      const blocks=groupItems.map(group=>({
        group:group.group,
        baseRows:makeRows(group.items,areaW),
        rows:[]
      }));
      if(blocks.some((b,i)=>!b.baseRows || !b.baseRows.length)) return null;

      // Reserva primeiro uma ocorrência de cada imagem de todos os grupos.
      let usedH=0;
      for(const block of blocks){
        block.rows=block.baseRows.map(r=>({...r,items:r.items.map(p=>({...p}))}));
        usedH+=rowsHeight(block.rows)+(block.rows.length?gap:0);
      }
      if(usedH>areaH+1e-7) return null;

      // Depois distribui as cópias pedidas em rodadas, sem misturar grupos.
      let requestedOverflow=false;
      for(let round=1;round<copies;round++){
        let placedAny=false;
        for(let i=0;i<blocks.length;i++){
          const block=blocks[i];
          const source=groupItems[i].items;
          const extraRows=makeRows(source,areaW);
          const extraH=rowsHeight(extraRows)+(block.rows.length?gap:0);
          if(usedH+extraH<=areaH+1e-7){
            block.rows.push(...extraRows.map(r=>({...r,items:r.items.map(p=>({...p}))})));
            usedH+=extraH;
            placedAny=true;
          }else{
            requestedOverflow=true;
          }
        }
        if(!placedAny) break;
      }

      // Só depois de todas as imagens originais e cópias que couberam,
      // repete ciclos completos por grupo para aproveitar o espaço restante.
      let safety=0,addedInLastCycle=!requestedOverflow;
      while(addedInLastCycle && safety++<100){
        addedInLastCycle=false;
        for(let i=0;i<blocks.length;i++){
          const block=blocks[i];
          const extraRows=makeRows(groupItems[i].items,areaW);
          const extraH=rowsHeight(extraRows)+(block.rows.length?gap:0);
          if(usedH+extraH<=areaH+1e-7){
            block.rows.push(...extraRows.map(r=>({...r,items:r.items.map(p=>({...p}))})));
            usedH+=extraH;
            addedInLastCycle=true;
          }
        }
      }

      // Depois de todas as imagens e cópias solicitadas estarem colocadas,
      // completa a largura livre de cada fileira com imagens do próprio grupo.
      // Nunca usa imagens de outro grupo e mantém a dimensão individual de cada peça.
      if(!requestedOverflow){
        for(let i=0;i<blocks.length;i++){
          const block=blocks[i];
          const source=groupItems[i].items;
          if(!source.length) continue;
          for(const row of block.rows){
            let usedW=row.items.reduce((sum,p,index)=>sum+p.w+(index?gap:0),0);
            let cursor=0,guard=0;
            while(guard++<2000){
              const candidate=source[cursor%source.length];
              const needed=(row.items.length?gap:0)+candidate.w;
              if(usedW+needed>areaW+1e-7) break;
              const localX=usedW+(row.items.length?gap:0);
              row.items.push({...candidate,localX});
              usedW=localX+candidate.w;
              cursor++;
            }
          }
        }
      }

      const placements=[];
      // Centraliza verticalmente o conjunto no modo inteligente, sem alterar
      // o alinhamento superior do modo de montagem normal.
      const totalRows=blocks.reduce((sum,block)=>sum+block.rows.length,0);
      const contentHeight=blocks.reduce((sum,block)=>sum+rowsHeight(block.rows),0)
        +Math.max(0,totalRows-1)*gap
        +Math.max(0,blocks.length-1)*gap;
      const verticalOffset=contentHeight>areaH*0.5
        ? Math.max(0,(areaH-contentHeight)/2)
        : 0;
      let y=margin+verticalOffset;
      for(const block of blocks){
        for(const row of block.rows){
          const rowW=row.items.reduce((sum,p,i)=>sum+p.w+(i?gap:0),0);
          const offsetX=Math.max(0,(areaW-rowW)/2);
          for(const p of row.items){
            placements.push({
              item:p.item,
              x:margin+offsetX+p.localX,
              y:y+(row.height-p.h)/2,
              w:p.w,h:p.h
            });
          }
          y+=row.height+gap;
        }
        if(block.rows.length) y+=gap;
      }
      if(y>margin+areaH) y=margin+areaH;

      const requested=state.images.length*copies;
      const firstOccurrenceCount=state.images.length;
      const occurrenceCount=new Map();
      placements.forEach(p=>occurrenceCount.set(p.item,(occurrenceCount.get(p.item)||0)+1));
      const requestedComplete=state.images.every(item=>(occurrenceCount.get(item)||0)>=copies);
      return {
        orientation,sw,sh,margin,gap,placements,
        capacity:placements.length,smart:true,requested,
        overflow:!requestedComplete,
        groupsSeparated:true
      };
    }

    const options=["portrait","landscape"].map(buildOrientation).filter(Boolean);
    if(!options.length){
      const sw=pw,sh=ph;
      return {orientation:"portrait",sw,sh,margin,gap,placements:[],capacity:0,smart:true,overflow:true,groupsSeparated:true};
    }
    options.sort((a,b)=>b.capacity-a.capacity);
    return options[0];
  }

  function makeOrderedCopies(){
    const copies=copiesCount();
    if(pageItemsOverride) return pageItemsOverride;
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

  function drawAdjustedImage(target,image,x,y,w,h,item,cover){
    const iw=image.naturalWidth,ih=image.naturalHeight;
    const rotation=((item.rotation||0)%360+360)%360;
    const quarterTurn=Math.abs(rotation%180)===90;
    const rotatedW=quarterTurn?ih:iw,rotatedH=quarterTurn?iw:ih;
    const baseScale=cover?Math.max(w/rotatedW,h/rotatedH):Math.min(w/rotatedW,h/rotatedH);
    const zoom=Math.max(0.5,Math.min(3,item.zoom??1));
    const drawW=iw*baseScale*zoom,drawH=ih*baseScale*zoom;
    const centerX=x+w/2+(item.panX||0)*w/100;
    const centerY=y+h/2+(item.panY||0)*h/100;
    target.save();
    target.beginPath();target.rect(x,y,w,h);target.clip();
    target.translate(centerX,centerY);
    target.rotate(rotation*Math.PI/180);
    target.drawImage(image,-drawW/2,-drawH/2,drawW,drawH);
    target.restore();
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
        const groupSize=state.groupSizes[p.item.group]||{};
        const containGroupFrame=$("adjustGroups").checked&&groupSize.w>0&&groupSize.h>0;
        drawAdjustedImage(c,p.item.image,x,y,w,h,p.item,containGroupFrame?false:$("fit").checked);
        c.restore();
      });
      if($("cutLines").checked){
        c.save();c.strokeStyle="#D2D3D5";c.lineWidth=Math.max(forExport?0.35:0.6,0.008*scale);
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
    const availableH=(sheetH-2*layout.margin)*scale;
    // Mantém no topo quando há poucas imagens; centraliza quando a montagem
    // ocupa mais da metade da área útil, independentemente do modo utilizado.
    const verticalOffset=gridH>availableH*0.5
      ? Math.max(0,(availableH-gridH)/2)
      : 0;
    const startY=y0+verticalOffset;
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
      const rotation=((item.rotation||0)%360+360)%360;
      const quarterTurn=Math.abs(rotation%180)===90;
      const rotatedW=quarterTurn?ih:iw;
      const rotatedH=quarterTurn?iw:ih;
      const baseScale=(itemSize.groupFrame || ($("adjustGroups").checked&&state.groupSizes[item.group]?.proportional>0))
        ? Math.min(targetW/rotatedW,targetH/rotatedH)
        : (cover
          ? Math.max(targetW/rotatedW,targetH/rotatedH)
          : Math.min(targetW/rotatedW,targetH/rotatedH));
      const zoom=Math.max(0.5,Math.min(3,item.zoom??1));
      const drawW=iw*baseScale*zoom;
      const drawH=ih*baseScale*zoom;
      const centerX=x+cellW/2+(item.panX||0)*targetW/100;
      const centerY=y+cellH/2+(item.panY||0)*targetH/100;
      c.save();
      c.translate(centerX,centerY);
      c.rotate(rotation*Math.PI/180);
      c.drawImage(item.image,-drawW/2,-drawH/2,drawW,drawH);
      c.restore();
      c.restore();
      if($("cutLines").checked && !layout.cxo){
        c.save();
        c.strokeStyle="#D2D3D5";
        c.lineWidth=Math.max(forExport?0.35:0.6,0.008*scale);
        c.strokeRect(x,y,cellW,cellH);
        c.restore();
      }
      if(layout.cxo && $("cutLines").checked){
        c.save(); c.beginPath();
        const r=cellW/2;
        c.moveTo(x,y+r); c.lineTo(x,y+cellH); c.lineTo(x+cellW,y+cellH);
        c.lineTo(x+cellW,y+r); c.arc(x+r,y+r,r,0,Math.PI,true); c.closePath();
        c.strokeStyle="#D2D3D5"; c.lineWidth=Math.max(forExport?0.35:0.6,0.008*scale); c.stroke(); c.restore();
      }
    });

  }

  // Mantém o comportamento de montagem original, calculando cada folha isoladamente.
  function layoutForPage(items){
    const originalImages=state.images;
    const oldOverride=pageItemsOverride,oldCopies=pageCopiesOverride;
    try{
      state.images=items;
      pageItemsOverride=items;
      pageCopiesOverride=1;
      return chooseLayout();
    }finally{
      state.images=originalImages;
      pageItemsOverride=oldOverride;
      pageCopiesOverride=oldCopies;
    }
  }
  function createPages(){
    const pages=[];
    const copies=copiesCount();
    for(let manual=0;manual<state.manualPages;manual++){
      const originals=state.images.filter(item=>(item.manualPage||0)===manual);
      const pending=[];
      for(const item of originals) for(let i=0;i<copies;i++) pending.push(item);
      if(!pending.length){pages.push({items:[],layout:null,manual});continue;}
      let offset=0,guard=0;
      while(offset<pending.length && guard++<2000){
        const remaining=pending.slice(offset);
        let layout=layoutForPage(remaining);
        // A montagem original pode mostrar peças abaixo da folha; aqui as excedentes
        // passam para a próxima página, sem alterar a distribuição dentro da folha.
        let count=Math.max(1,Math.min(remaining.length,layout?.capacity||1));
        if(layout?.overflow && count===remaining.length && count>1) count--;
        let chosen=remaining.slice(0,count);
        layout=layoutForPage(chosen);
        while(count>1 && layout?.overflow){
          count--;chosen=remaining.slice(0,count);layout=layoutForPage(chosen);
        }
        pages.push({items:chosen,layout,manual,oversized:!!layout?.overflow});
        offset+=count;
      }
    }
    return pages;
  }
  function updatePageControls(){
    const total=state.pages.length||1;
    $("pageCounter").textContent=`${state.currentPage+1} / ${total}`;
    $("pagePrevious").disabled=state.currentPage===0;
    $("pageNext").disabled=state.currentPage>=total-1;
    const current=state.pages[state.currentPage];
    const removable=!!current && current.items.length===0 && current.manual>0 &&
      !state.images.some(item=>(item.manualPage||0)===current.manual) && state.manualPages>1;
    $("pageRemove").disabled=!removable;
  }
  $("pagePrevious").addEventListener("click",()=>{if(state.currentPage>0){state.currentPage--;updatePreview();}});
  $("pageNext").addEventListener("click",()=>{if(state.currentPage<state.pages.length-1){state.currentPage++;updatePreview();}});
  $("pageAdd").addEventListener("click",()=>{
    state.manualPages++;
    state.currentPage=state.pages.length;
    updatePreview();
  });
  $("pageRemove").addEventListener("click",()=>{
    const page=state.pages[state.currentPage];
    // Exclui somente uma página manual vazia. Não remove páginas automáticas
    // de continuação nem qualquer página que contenha imagens.
    if(!page || page.items.length!==0 || state.manualPages<=1) return;
    const manualToRemove=page.manual;
    if(!Number.isInteger(manualToRemove) || manualToRemove===0) return;
    const hasImages=state.images.some(item=>(item.manualPage||0)===manualToRemove);
    if(hasImages) return;
    state.images.forEach(item=>{
      if((item.manualPage||0)>manualToRemove) item.manualPage--;
    });
    state.manualPages--;
    state.currentPage=Math.max(0,state.currentPage-1);
    updatePreview();
  });
  function updatePreview(){
    state.pages=createPages();
    state.currentPage=Math.min(state.currentPage,Math.max(0,state.pages.length-1));
    updatePageControls();
    const page=state.pages[state.currentPage];
    if(!page?.items.length){
      canvas.style.display="none";$("emptyState").style.display="flex";
      $("sizeInfo").textContent="Página em branco";
      $("paperInfo").textContent=state.paper;
      $("download").disabled=!state.images.length;
      setStatus(state.images.length?"Página em branco. Envie imagens para esta página.":"Adicione imagens para começar.");
      return;
    }
    const layout=page.layout;state.layout=layout;
    if(!layout){setStatus("Não foi possível calcular a montagem.",true);return;}
    pageItemsOverride=page.items;
    try{drawSheet(canvas,layout,false);}finally{pageItemsOverride=null;}
    canvas.style.display="block";$("emptyState").style.display="none";
    const orient=layout.orientation==="portrait"?"Retrato":"Paisagem";
    $("paperInfo").textContent=`${state.paper} • ${orient}`;
    $("sizeInfo").textContent=`${page.items.length} unidades • Página ${state.currentPage+1} de ${state.pages.length}`;
    $("download").disabled=state.pages.some(p=>p.oversized);
    setStatus(page.oversized?"Uma imagem não cabe na folha com as dimensões escolhidas.":`${state.pages.length} página(s) • ${state.images.length*copiesCount()} imagens ao todo`,page.oversized);
  }

  function renderFileList(){
    const list=$("fileList");list.innerHTML="";
    let lastGroup=0;
    state.images.forEach((item,index)=>{
      if(item.group!==lastGroup){
        const heading=document.createElement("div");heading.className="file-group-title";
        const title=document.createElement("strong");title.textContent=`GRUPO ${item.group}`;
        heading.append(title);
        const groupSize=state.groupSizes[item.group]||(state.groupSizes[item.group]={proportional:0,w:0,h:0});
        const sizeControls=document.createElement("div");sizeControls.className="file-group-size";sizeControls.hidden=!$("adjustGroups").checked;
        const proportionalRow=document.createElement("label");proportionalRow.className="group-proportional-row";
        const proportionalCaption=document.createElement("span");proportionalCaption.textContent="Proporcional:";
        const proportionalInput=document.createElement("input");
        proportionalInput.type="number";proportionalInput.min="0.1";proportionalInput.max="99";proportionalInput.step="0.1";
        proportionalInput.placeholder="";proportionalInput.value=groupSize.proportional||"";
        proportionalInput.setAttribute("aria-label",`Altura proporcional do grupo ${item.group} em centímetros`);
        proportionalInput.addEventListener("change",()=>{
          groupSize.proportional=parseFloat(proportionalInput.value)>0?parseFloat(proportionalInput.value):0;
          if(groupSize.proportional>0){
            groupSize.w=0;groupSize.h=0;
            xInput.value="";yInput.value="";
          }
          updatePreview();
        });
        proportionalRow.append(proportionalCaption,proportionalInput);
        const axesRow=document.createElement("div");axesRow.className="group-axes-row";
        const makeGroupInput=(axis,placeholder,label)=>{
          const wrap=document.createElement("label");wrap.className="group-axis-field";
          const caption=document.createElement("span");caption.textContent=axis+":";
          const input=document.createElement("input");
          input.type="number";input.min="0.1";input.max="99";input.step="1";input.inputMode="numeric";
          input.placeholder=placeholder;input.value=groupSize[axis==="X"?"w":"h"]||"";
          input.setAttribute("aria-label",`${label} do grupo ${item.group} em centímetros`);
          input.addEventListener("change",()=>{
            groupSize[axis==="X"?"w":"h"]=parseFloat(input.value)>0?parseFloat(input.value):0;
            if(groupSize.w>0||groupSize.h>0){
              groupSize.proportional=0;
              proportionalInput.value="";
            }
            updatePreview();
          });
          return {wrap,input};
        };
        const xField=makeGroupInput("X","cm","Largura");
        const yField=makeGroupInput("Y","cm","Altura");
        const xInput=xField.input,yInput=yField.input;
        xField.wrap.append(xInput);yField.wrap.append(yInput);
        axesRow.append(xField.wrap,yField.wrap);
        sizeControls.append(proportionalRow,axesRow);
        heading.append(sizeControls);
        list.append(heading);lastGroup=item.group;
      }
      const row=document.createElement("div");row.className="file-item";row.dataset.imageIndex=String(index);
      // Cada imagem funciona como um único bloco na navegação por TAB.
      row.tabIndex=0;
      row.setAttribute("role","group");
      row.setAttribute("aria-label",`Bloco da imagem ${index+1}: ${item.file.name}`);
      row.addEventListener("focus",()=>{
        selectedItem=item;
        updateSelectedRows();
      });
      const img=document.createElement("img");img.src=item.url;img.alt="";
      const meta=document.createElement("div");meta.className="file-meta";
      const name=document.createElement("span");name.className="file-name";name.textContent=item.file.name;
      const sizes=document.createElement("div");sizes.className="custom-size";
      const w=document.createElement("input");w.type="number";w.min="0.1";w.max="100";w.step="0.1";w.placeholder="L cm";w.value=item.customW||"";w.tabIndex=-1;w.setAttribute("aria-label",`Largura personalizada da imagem ${item.file.name}`);
      const h=document.createElement("input");h.type="number";h.min="0.1";h.max="100";h.step="0.1";h.placeholder="A cm";h.value=item.customH||"";h.tabIndex=-1;h.setAttribute("aria-label",`Altura personalizada da imagem ${item.file.name}`);
      const unit=document.createElement("em");unit.textContent="cm";
      const apply=()=>{item.customW=parseFloat(w.value)>0?parseFloat(w.value):0;item.customH=parseFloat(h.value)>0?parseFloat(h.value):0;updatePreview();};
      w.addEventListener("change",apply);h.addEventListener("change",apply);
      sizes.append(w,document.createTextNode("×"),h,unit);
      meta.append(name,sizes);

      item.rotation=item.rotation||0;
      item.zoom=item.zoom??1;
      item.panX=item.panX||0;
      item.panY=item.panY||0;
      const edit=document.createElement("div");
      edit.className="cxo-image-controls image-position-controls";

      const makeButton=(caption,title,action,className="image-adjust-button")=>{
        const button=document.createElement("button");
        button.type="button";
        button.tabIndex=-1;
        button.className=className;
        button.textContent=caption;
        button.title=title;
        button.setAttribute("aria-label",title);
        button.addEventListener("click",event=>{
          event.preventDefault();event.stopPropagation();
          selectedItem=item;
          action();
          updateSelectedRows();
          const zoomReadout=edit.querySelector(".image-zoom-value");
          if(zoomReadout) zoomReadout.textContent=`${Math.round(item.zoom*100)}%`;
          updatePreview();
        });
        return button;
      };
      const changeZoom=amount=>{
        item.zoom=Math.max(0.5,Math.min(3,Math.round((item.zoom+amount)*100)/100));
      };
      const move=(x,y)=>{
        item.panX=Math.max(-100,Math.min(100,item.panX+x));
        item.panY=Math.max(-100,Math.min(100,item.panY+y));
      };
      edit.append(
        makeButton("−","Diminuir zoom",()=>changeZoom(-0.1)),
        makeButton(`${Math.round(item.zoom*100)}%`,"Zoom atual",()=>{item.zoom=1;},"image-zoom-value"),
        makeButton("+","Aumentar zoom",()=>changeZoom(0.1)),
        makeButton("←","Mover para a esquerda",()=>move(-2,0)),
        makeButton("↑","Mover para cima",()=>move(0,-2)),
        makeButton("↓","Mover para baixo",()=>move(0,2)),
        makeButton("→","Mover para a direita",()=>move(2,0))
      );
      if(state.paper==="CXSÓ"){
        const rotate=makeButton("↻","Girar 90°",()=>{
          item.rotation=(item.rotation+90)%360;
        },"cxo-rotate");
        edit.append(rotate);
      }
      meta.append(edit);
      row.addEventListener("click",()=>{selectedItem=item;updateSelectedRows();});
      img.addEventListener("click",event=>{event.stopPropagation();selectedItem=item;updateSelectedRows();});


      const remove=document.createElement("button");remove.className="remove-file";remove.type="button";remove.tabIndex=-1;remove.textContent="×";remove.title="Remover imagem";
      remove.addEventListener("click",event=>{event.stopPropagation();URL.revokeObjectURL(item.url);state.images.splice(index,1);if(selectedItem===item) selectedItem=state.images[Math.min(index,state.images.length-1)]||null;
        const usedGroups=new Set(state.images.map(image=>image.group));
        state.nextGroup=Array.from({length:9},(_,i)=>i+1).find(group=>!usedGroups.has(group))||10;
        renderGroupHeights();updatePreview();});
      row.append(img,meta,remove);list.append(row);
    });
    updateSelectedRows();
  }

  async function addFiles(files){
    const valid=[...files].filter(f=>/^image\/(png|jpeg)$/.test(f.type));
    if(!valid.length){setStatus("Selecione arquivos PNG ou JPEG.");return;}
    const group=state.nextGroup;
    if(group>9){setStatus("Limite de 9 grupos atingido. Remova as imagens de um grupo antes de adicionar outro.",true);return;}
    let added=0;
    for(const file of valid){
      const url=URL.createObjectURL(file);
      try{
        const image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
        state.images.push({file,url,image,customW:0,customH:0,group,manualPage:state.pages[state.currentPage]?.manual??0,rotation:0,zoom:1,panX:0,panY:0}); if(!selectedItem) selectedItem=state.images[state.images.length-1]; added++;
      }catch(e){URL.revokeObjectURL(url);}
    }
    if(added) state.nextGroup=Math.min(10,group+1);
    renderGroupHeights();updatePreview();
  }

  function renderGroupHeights(){
    renderFileList();
  }

  $("fileInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  ["copies","fit","cutLines"].forEach(id=>$(id).addEventListener("input",schedulePreview));
  $("smartFill").addEventListener("change",schedulePreview);
  $("smartFill").addEventListener("input",schedulePreview);
  $("adjustGroups").addEventListener("change",()=>{
    renderGroupHeights();
    updatePreview();
  });
  document.querySelectorAll(".paper-tab").forEach(btn=>btn.addEventListener("click",()=>{
    state.paper=btn.dataset.paper;
    document.querySelectorAll(".paper-tab").forEach(b=>b.classList.toggle("active",b===btn));
    renderFileList();
    updatePreview();
  }));
  document.addEventListener("keydown",event=>{
    if(!selectedItem || !state.images.includes(selectedItem)) return;
    if(event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){
      event.preventDefault();
      const step=event.shiftKey?5:1;
      if(event.key==="ArrowLeft") selectedItem.panX=Math.max(-100,selectedItem.panX-step);
      if(event.key==="ArrowRight") selectedItem.panX=Math.min(100,selectedItem.panX+step);
      if(event.key==="ArrowUp") selectedItem.panY=Math.max(-100,selectedItem.panY-step);
      if(event.key==="ArrowDown") selectedItem.panY=Math.min(100,selectedItem.panY+step);
      updatePreview();
    }else if(event.key==="+" || event.key==="="){
      event.preventDefault();selectedItem.zoom=Math.min(3,Math.round((selectedItem.zoom+0.1)*100)/100);renderFileList();updatePreview();
    }else if(event.key==="-"){
      event.preventDefault();selectedItem.zoom=Math.max(0.5,Math.round((selectedItem.zoom-0.1)*100)/100);renderFileList();updatePreview();
    }
  });

  const drop=$("dropzone");
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("dragover");}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("dragover");}));
  drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));

  $("download").addEventListener("click",()=>{
    if(!state.images.length||!state.pages.length)return;
    const btn=$("download");btn.disabled=true;setStatus("Gerando arquivo em alta resolução…");
    try{
      const format=$("format").value;
      const renderPage=(page,transparent)=>{
        const output=document.createElement("canvas");
        if(!page.layout){
          const [pw,ph]=sheetDimensions();
          output.width=Math.round(pw*300/2.54);output.height=Math.round(ph*300/2.54);
          if(!transparent){const c=output.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,output.width,output.height);}
        }else{
          pageItemsOverride=page.items;
          try{drawSheet(output,page.layout,true,transparent);}finally{pageItemsOverride=null;}
        }
        return output;
      };
      if(format==="pdf"){
        if(!window.jspdf?.jsPDF){setStatus("Não foi possível carregar o gerador de PDF.");btn.disabled=false;return;}
        const {jsPDF}=window.jspdf;
        let pdf=null;
        state.pages.forEach((page,index)=>{
          const [pw,ph]=sheetDimensions();
          const landscape=page.layout?.orientation==="landscape";
          const w=(landscape?ph:pw)*10,h=(landscape?pw:ph)*10;
          if(!pdf)pdf=new jsPDF({orientation:landscape?"landscape":"portrait",unit:"mm",format:[w,h],compress:true});
          else pdf.addPage([w,h],landscape?"landscape":"portrait");
          pdf.addImage(renderPage(page,false).toDataURL("image/jpeg",0.98),"JPEG",0,0,w,h,undefined,"FAST");
        });
        pdf.save(`paperpel-${state.paper.toLowerCase()}-${state.pages.length}-paginas.pdf`);
        setStatus(`PDF gerado com ${state.pages.length} páginas em 300 DPI.`);
        btn.disabled=false;return;
      }
      // PNG/JPG continuam exportando a página que está sendo visualizada.
      const output=renderPage(state.pages[state.currentPage],format==="png");
      output.toBlob(blob=>{
        if(!blob){setStatus("Não foi possível gerar o arquivo.");btn.disabled=false;return;}
        const a=document.createElement("a"),url=URL.createObjectURL(blob);
        a.href=url;a.download=`paperpel-${state.paper.toLowerCase()}-pagina-${state.currentPage+1}-300dpi.${format==="png"?"png":"jpg"}`;
        document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
        setStatus(`Página ${state.currentPage+1} exportada em ${format.toUpperCase()}.`);btn.disabled=false;
      },format==="png"?"image/png":"image/jpeg",format==="jpeg"?0.98:undefined);
    }catch(err){console.error(err);setStatus("Não foi possível gerar o arquivo.",true);btn.disabled=false;}
  });

  $("paperInfo").textContent="A4 • Paisagem";
})();