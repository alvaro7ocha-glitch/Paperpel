
/* PAPERPEL GAMIFICAÇÃO — API, fichas e fotos */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const app = document.querySelector(".ppg-app");
  const status = $("ppg-status");

  const fields = {
    name: $("ppg-name"),
    classe: $("ppg-class"),
    hobbies: $("ppg-hobbies")
  };

  const skills = [...document.querySelectorAll(".ppg-skill")];
  const photoBtn = $("ppg-photo-button");
  const photoFile = $("ppg-photo-file");
  const photoImg = $("ppg-photo-preview");
  const saveBtn = $("ppg-save");

  const API_URL = "https://paperpel-api.onrender.com";
  let photoData = "";

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function slugify(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Exibe a foto sem recriar o elemento HTML.
  function applyPhotoToUI(data) {
    if (!photoImg || !data || typeof data !== "string") {
      if (photoImg) {
        photoImg.removeAttribute("src");
        photoImg.hidden = true;
      }
      return;
    }

    photoImg.onload = () => {
      photoImg.hidden = false;
      photoImg.style.display = "block";
      photoImg.style.width = "100%";
      photoImg.style.height = "100%";
      photoImg.style.objectFit = "cover";
    };

    photoImg.onerror = () => {
      photoImg.hidden = true;
      setStatus("Não foi possível exibir esta foto.");
      console.error("Falha ao carregar a imagem da ficha.");
    };

    photoImg.src = data;
    photoImg.hidden = false;
    photoImg.style.display = "block";
    photoImg.style.width = "100%";
    photoImg.style.height = "100%";
    photoImg.style.objectFit = "cover";
  }

  // Inicializa as estrelas.
  skills.forEach(row => {
    const group = row.querySelector(".ppg-stars");
    if (!group) return;

    group.replaceChildren();

    for (let n = 1; n <= 5; n++) {
      const star = document.createElement("button");
      star.type = "button";
      star.className = "ppg-star";
      star.textContent = "★";
      star.setAttribute("aria-label", `${n} de 5 estrelas`);
      star.setAttribute("aria-pressed", "false");

      star.addEventListener("click", () => {
        if (app.classList.contains("ppg-readonly")) return;

        const current = Number(group.dataset.value || 0);
        const value = current === n ? 0 : n;

        group.dataset.value = String(value);

        [...group.children].forEach((element, index) => {
          element.classList.toggle("is-filled", index < value);
          element.setAttribute(
            "aria-pressed",
            String(index < value)
          );
        });
      });

      group.appendChild(star);
    }
  });

  // Selecionar e ler a foto.
  if (photoBtn && photoFile) {
    photoBtn.addEventListener("click", () => {
      if (!app.classList.contains("ppg-readonly")) {
        photoFile.click();
      }
    });

    photoFile.addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setStatus("Selecione um arquivo de imagem.");
        photoFile.value = "";
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        setStatus("A foto deve ter até 3 MB.");
        photoFile.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        photoData = String(reader.result);
        applyPhotoToUI(photoData);
        setStatus("Foto selecionada. Salve a ficha para guardar as alterações.");
      };

      reader.onerror = () => {
        setStatus("Não foi possível ler o arquivo da foto.");
      };

      reader.readAsDataURL(file);
    });
  }

  // Validação da classe.
  if (fields.classe) {
    fields.classe.addEventListener("input", () => {
      fields.classe.value = fields.classe.value
        .replace(/[^a-z]/gi, "")
        .slice(0, 3)
        .toUpperCase();
    });
  }

  // Limita os hobbies a duas linhas.
  if (fields.hobbies) {
    fields.hobbies.addEventListener("input", () => {
      const lines = fields.hobbies.value.split(/\r?\n/).slice(0, 2);
      fields.hobbies.value = lines.join("\n");
    });
  }

  // Salva na API e mantém o endereço da ficha.
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const name = fields.name.value.trim();
      const slug = slugify(name);

      if (!name || !slug) {
        setStatus("Digite o primeiro nome antes de salvar.");
        fields.name.focus();
        return;
      }

      const ratings = {};

      skills.forEach(row => {
        const group = row.querySelector(".ppg-stars");
        ratings[row.dataset.skill] = Number(group?.dataset.value || 0);
      });

      const record = {
        name,
        slug,
        classe: fields.classe.value.trim().slice(0, 3),
        hobbies: fields.hobbies.value,
        ratings,
        photo: photoData,
        updatedAt: new Date().toISOString()
      };

      saveBtn.disabled = true;
      setStatus("Salvando ficha na nuvem...");

      try {
        const response = await fetch(`${API_URL}/api/fichas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(record)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.erro || result.error ||
            `O servidor respondeu com HTTP ${response.status}.`
          );
        }

        setStatus(`Ficha de ${name} salva com sucesso! Endereço: /${slug}`);
        history.pushState({}, "", `/${slug}`);
      } catch (error) {
        console.error("Erro ao salvar ficha:", error);
        setStatus(`Não foi possível salvar na nuvem: ${error.message}`);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Minimizar a ficha.
  const minimizeBtn = $("ppg-minimize");

  if (minimizeBtn && app) {
    minimizeBtn.addEventListener("click", () => {
      app.classList.toggle("ppg-minimized");
    });
  }

  // Fechar a ficha.
  const closeBtn = $("ppg-close");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (confirm("Fechar a ficha?")) {
        location.href = "/";
      }
    });
  }

  // Carrega a ficha correspondente ao endereço /nome.
  async function loadRequestedRecord() {
    const segments = location.pathname.split("/").filter(Boolean);
    let requested = segments.pop() || "";

    if (requested.endsWith(".html")) {
      requested = segments.pop() || "";
    }

    requested = decodeURIComponent(requested);

    if (!requested || requested.toLowerCase() === "novo") return;

    setStatus("Carregando ficha da nuvem...");

    try {
      const response = await fetch(
        `${API_URL}/api/fichas/${encodeURIComponent(slugify(requested))}`
      );

      if (!response.ok) {
        throw new Error(`Ficha não encontrada (HTTP ${response.status}).`);
      }

      const rec = await response.json();

      fields.name.value = rec.name || "";
      fields.classe.value = rec.classe || "";
      fields.hobbies.value = rec.hobbies || "";

      photoData = typeof rec.photo === "string" ? rec.photo : "";

      if (photoData) {
        applyPhotoToUI(photoData);
      } else if (photoImg) {
        photoImg.removeAttribute("src");
        photoImg.hidden = true;
      }

      skills.forEach(row => {
        const group = row.querySelector(".ppg-stars");
        if (!group) return;

        const key = row.dataset.skill;
        const ratings = rec.ratings || {};
        const value = Number(
          ratings[key] ??
          ratings[key.toLowerCase()] ??
          ratings[key.toUpperCase()] ??
          0
        );

        group.dataset.value = String(value);

        [...group.children].forEach((star, index) => {
          star.classList.toggle("is-filled", index < value);
          star.setAttribute("aria-pressed", String(index < value));
        });
      });

      app.classList.add("ppg-readonly");

      fields.name.readOnly = true;
      fields.classe.readOnly = true;
      fields.hobbies.readOnly = true;

      if (photoBtn) photoBtn.style.cursor = "default";
      if (photoFile) photoFile.disabled = true;
      if (saveBtn) saveBtn.style.display = "none";

      setStatus(
        photoData
          ? `A visualizar ficha de ${rec.name}.`
          : `Ficha de ${rec.name} carregada, mas não há foto salva.`
      );
    } catch (error) {
      console.error("Erro ao carregar ficha:", error);
      setStatus(`Não foi possível carregar a ficha: ${error.message}`);
    }
  }

  loadRequestedRecord();
})();
