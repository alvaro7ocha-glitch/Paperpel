/* PAPERPEL GAMIFICAÇÃO — armazenamento local provisório. */
(() => {
  const $ = (id) => document.getElementById(id);
  const app = document.querySelector(".ppg-app");
  const status = $("ppg-status");
  const fields = {
    name: $("ppg-name"), classe: $("ppg-class"), hobbies: $("ppg-hobbies")
  };
  const skills = [...document.querySelectorAll(".ppg-skill")];
  let photoData = "";
  skills.forEach(row => {
    const group = row.querySelector(".ppg-stars");
    for (let n=1;n<=5;n++){
      const star=document.createElement("button");
      star.type="button"; star.className="ppg-star"; star.textContent="★";
      star.setAttribute("aria-label",`${n} de 5 estrelas`);
      star.setAttribute("aria-pressed","false");
      star.addEventListener("click",()=>{
        const current=Number(group.dataset.value||0);
        const value=current===n?0:n;
        group.dataset.value=String(value);
        [...group.children].forEach((s,i)=>{
          s.classList.toggle("is-filled",i<value);
          s.setAttribute("aria-pressed",String(i<value));
        });
      });
      group.appendChild(star);
    }
  });
  $("ppg-photo-button").addEventListener("click",()=>$("ppg-photo-file").click());
  $("ppg-photo-file").addEventListener("change",e=>{
    const file=e.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/")){status.textContent="Selecione um arquivo de imagem.";return;}
    if(file.size>3*1024*1024){status.textContent="A foto deve ter até 3 MB.";return;}
    const reader=new FileReader();
    reader.onload=()=>{photoData=String(reader.result);$("ppg-photo-preview").src=photoData;$("ppg-photo-preview").hidden=false;$("ppg-photo-placeholder").hidden=true;};
    reader.readAsDataURL(file);
  });
  fields.classe.addEventListener("input",()=>{fields.classe.value=fields.classe.value.replace(/[^a-z]/gi,"").slice(0,3).toUpperCase();});
  fields.hobbies.addEventListener("input",()=>{
    const lines=fields.hobbies.value.split(/\r?\n/).slice(0,2);
    fields.hobbies.value=lines.join("\n");
  });
  const slugify=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  $("ppg-save").addEventListener("click",()=>{
    const name=fields.name.value.trim(), slug=slugify(name);
    if(!name||!slug){status.textContent="Digite o primeiro nome antes de salvar.";fields.name.focus();return;}
    const ratings={};
    skills.forEach(row=>ratings[row.dataset.skill]=Number(row.querySelector(".ppg-stars").dataset.value||0));
    const record={name,slug,classe:fields.classe.value.trim().slice(0,3),hobbies:fields.hobbies.value,ratings,photo:photoData,updatedAt:new Date().toISOString()};
    try{
      const all=JSON.parse(localStorage.getItem("paperpel-gamificacao-funcionarios")||"{}");
      all[slug]=record;localStorage.setItem("paperpel-gamificacao-funcionarios",JSON.stringify(all));
      status.textContent=`Ficha de ${name} salva neste navegador. Endereço previsto: /${slug}`;
    }catch(err){status.textContent="Não foi possível salvar. A foto pode ser grande demais; tente uma imagem menor.";}
  });
  $("ppg-minimize").addEventListener("click",()=>app.classList.toggle("ppg-minimized"));
  $("ppg-close").addEventListener("click",()=>{
    if(confirm("Fechar a ficha? Os dados não salvos serão perdidos.")) location.href="../";
  });
  // Se abrir /novo/nome ou carregar um registro local, preenche o formulário.
  const requested=decodeURIComponent(location.pathname.split("/").filter(Boolean).pop()||"");
  if(requested && requested!=="novo"){
    try{
      const all=JSON.parse(localStorage.getItem("paperpel-gamificacao-funcionarios")||"{}");
      const rec=all[slugify(requested)];
      if(rec){
        fields.name.value=rec.name;fields.classe.value=rec.classe||"";fields.hobbies.value=rec.hobbies||"";photoData=rec.photo||"";
        if(photoData){$("ppg-photo-preview").src=photoData;$("ppg-photo-preview").hidden=false;$("ppg-photo-placeholder").hidden=true;}
        skills.forEach(row=>{const v=Number(rec.ratings?.[row.dataset.skill]||0);const g=row.querySelector(".ppg-stars");g.dataset.value=v;[...g.children].forEach((s,i)=>{s.classList.toggle("is-filled",i<v);s.setAttribute("aria-pressed",String(i<v));});});
      }
    }catch(_){}
  }
})();