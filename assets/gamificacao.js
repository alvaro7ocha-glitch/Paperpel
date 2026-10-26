/* PAPERPEL GAMIFICAÇÃO — Integração com API e Neon */
(() => {
  const $ = (id) => document.getElementById(id);
  const app = document.querySelector(".ppg-app");
  const status = $("ppg-status");
  const fields = {
    name: $("ppg-name"), classe: $("ppg-class"), hobbies: $("ppg-hobbies")
  };
  const skills = [...document.querySelectorAll(".ppg-skill")];
  let photoData = "";
  
  // Atualizado para o novo Web Service isolado na Render (mantendo o bot do Typebot 100% intacto)
  const API_URL = "https://paperpel-api.onrender.com";

  // Inicialização das Estrelas
  skills.forEach(row => {
    const group = row.querySelector(".ppg-stars");
    for (let n = 1; n <= 5; n++) {
      const star = document.createElement("button");
      star.type = "button"; star.className = "ppg-star"; star.textContent = "★";
      star.setAttribute("aria-label", `${n} de 5 estrelas`);
      star.setAttribute("aria-pressed", "false");
      star.addEventListener("click", () => {
        if (app.classList.contains("ppg-readonly")) return; // Impede edição em modo somente leitura
        const current = Number(group.dataset.value || 0);
        const value = current === n ? 0 : n;
        group.dataset.value = String(value);
        [...group.children].forEach((s, i) => {
          s.classList.toggle("is-filled", i < value);
          s.setAttribute("aria-pressed", String(i < value));
        });
      });
      group.appendChild(star);
    }
  });

  // Upload da Foto
  const photoBtn = $("ppg-photo-button");
  const photoFile = $("ppg-photo-file");
  if (photoBtn && photoFile) {
    photoBtn.addEventListener("click", () => photoFile.click());
    photoFile.addEventListener("change", e => {
      const file = e.target.files?.[0]; if (!file) return;
      if (!file.type.startsWith("image/")) { status.textContent = "Selecione um arquivo de imagem."; return; }
      if (file.size > 3 * 1024 * 1024) { status.textContent = "A foto deve ter até 3 MB."; return; }
      const reader = new FileReader();
      reader.onload = () => {
        photoData = String(reader.result);
        $("ppg-photo-preview").src = photoData;
        $("ppg-photo-preview").hidden = false;
        $("ppg-photo-placeholder").hidden = true;
      };
      reader.readAsDataURL(file);
    });
  }

  // Validação dos Inputs
  fields.classe.addEventListener("input", () => {
    fields.classe.value = fields.classe.value.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
  });
  fields.hobbies.addEventListener("input", () => {
    const lines = fields.hobbies.value.split(/\r?\n/).slice(0, 2);
    fields.hobbies.value = lines.join("\n");
  });

  const slugify = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Ação do Botão Salvar
  $("ppg-save").addEventListener("click", async () => {
    const name = fields.name.value.trim(), slug = slugify(name);
    if (!name || !slug) { status.textContent = "Digite o primeiro nome antes de salvar."; fields.name.focus(); return; }

    const ratings = {};
    skills.forEach(row => ratings[row.dataset.skill] = Number(row.querySelector(".ppg-stars").dataset.value || 0));

    const record = {
      name, slug,
      classe: fields.classe.value.trim().slice(0, 3),
      hobbies: fields.hobbies.value,
      ratings,
      photo: photoData,
      updatedAt: new Date().toISOString()
    };

    status.textContent = "A salvar na nuvem (Neon)...";

    try {
      const response = await fetch(`${API_URL}/api/fichas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });

      const result = await response.json();
      if (response.ok) {
        status.textContent = `Ficha de ${name} salva com sucesso! Endereço: /${slug}`;
        window.history.pushState({}, "", `/${slug}`);
      } else {
        status.textContent = `Erro do servidor: ${result.erro || "Desconhecido"}`;
      }
    } catch (err) {
      console.error(err);
      status.textContent = `Erro de rede: ${err.message}`;
    }
  });

  $("ppg-minimize").addEventListener("click", () => app.classList.toggle("ppg-minimized"));
  $("ppg-close").addEventListener("click", () => {
    if (confirm("Fechar a ficha?")) location.href = "../";
  });

  // Leitura e Busca por Slug na Nuvem (Ex: /alvaro) com segurança para o GitHub Pages
  const pathSegments = location.pathname.split("/").filter(Boolean);
  let requested = pathSegments.pop() || "";
  if (requested.endsWith(".html")) {
    requested = pathSegments.pop() || "";
  }
  requested = decodeURIComponent(requested);

  if (requested && requested !== "novo" && requested !== "Paperpel") {
    status.textContent = "A carregar ficha da nuvem...";
    fetch(`${API_URL}/api/fichas/${slugify(requested)}`)
      .then(res => {
        if (!res.ok) throw new Error("Ficha não encontrada");
        return res.json();
      })
      .then(rec => {
        fields.name.value = rec.name;
        fields.classe.value = rec.classe || "";
        fields.hobbies.value = rec.hobbies || "";
        photoData = rec.photo || "";

        if (photoData) {
          $("ppg-photo-preview").src = photoData;
          $("ppg-photo-preview").hidden = false;
          $("ppg-photo-placeholder").hidden = true;
        }

        skills.forEach(row => {
          const v = Number(rec.ratings?.[row.dataset.skill] || 0);
          const g = row.querySelector(".ppg-stars");
          g.dataset.value = v;
          [...g.children].forEach((s, i) => {
            s.classList.toggle("is-filled", i < v);
            s.setAttribute("aria-pressed", String(i < v));
          });
        });

        // Modo somente leitura
        app.classList.add("ppg-readonly");
        fields.name.setAttribute("readonly", true);
        fields.classe.setAttribute("readonly", true);
        fields.hobbies.setAttribute("readonly", true);
        if (photoBtn) photoBtn.style.display = "none";
        $("ppg-save").style.display = "none";

        status.textContent = `A visualizar ficha de ${rec.name}`;
      })
      .catch(err => {
        console.error(err);
        status.textContent = "Ficha não encontrada na nuvem.";
      });
  }
})();
