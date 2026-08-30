document.addEventListener("DOMContentLoaded", () => {
  const section = document.getElementById("avaliacoes");
  const track = document.getElementById("reviewsTrack");
  const prev = document.querySelector(".review-arrow.prev");
  const next = document.querySelector(".review-arrow.next");
  const dotsBox = document.getElementById("reviewDots");

  if (!section || !track || !prev || !next || !dotsBox) return;

  // Remove any old/static review cards that may still be present from a cached page.
  section.querySelectorAll(".review-card").forEach(card => card.remove());

  const reviews = [
    {
      name: "Mayana Rodrigues",
      meta: "7 avaliações · 2 semanas atrás",
      text: "Atendimento atencioso e personalizado! Tudo que precisei foi feito super rápido e com a maior qualidade. Indico de olhos fechados 💜",
      photo: "assets/reviews/Mayana Rodrigues.png"
    },
    {
      name: "Eliza",
      meta: "4 avaliações · 6 meses atrás",
      text: "Ótimo atendimento, além da rapidez e qualidade do trabalho.",
      photo: "assets/reviews/Eliza.png"
    },
    {
      name: "Bruna Maciel",
      meta: "2 avaliações · 2 meses atrás",
      text: "Produtos de excelente qualidade e um ótimo atendimento",
      photo: "assets/reviews/Bruna Maciel.png"
    },
    {
      name: "Sílvia Fidelis",
      meta: "1 avaliação · 11 meses atrás",
      text: "Atendimento excelente... rápidos, cordiais e excelência no atendimento que tive. Fiz o cartão e troca da cor da arte do meu cartão. Super recomendo",
      photo: "assets/reviews/Silvia Fidelis.png"
    },
    {
      name: "Jessica Machado",
      meta: "3 avaliações · 5 meses atrás",
      text: "Sempre sou muito bem atendida lá, e o serviço prestado tem sempre um ótimo resultado. Trabalho com arte e as vezes peço tamanhos de impressão personalizados e eles arrasam em tudo.",
      photo: "assets/reviews/Jessica Machado.png"
    },
    {
      name: "Ana Carolina Gonçalves",
      meta: "4 avaliações · 5 meses atrás",
      text: "Atendimento excelente, rápido e caprichoso.",
      photo: "assets/reviews/Ana Carolina.png"
    },
    {
      name: "Sergio Santos",
      meta: "4 avaliações · 3 anos atrás",
      text: "Gratidão pelo trabalho prestado. Preço justo, atendimento maravilhoso, profissionalismo e prazo. RECOMENDO!",
      photo: "assets/reviews/Sergio Santos.png"
    },
    {
      name: "Iris Valin",
      meta: "1 avaliação · 2 anos atrás",
      text: "Atendimento maravilhoso! Super atenciosos e a qualidade da impressão é ótima! Além da rapidez que o brasileiro aaaaaama!",
      photo: "assets/reviews/Iris Valin.png"
    },
    {
      name: "Luísa Neves",
      meta: "7 avaliações · 5 meses atrás",
      text: "Encomendei uma foto 10x15 e algumas fotos 3x4 e eu amei a qualidade, ficaram muito lindas! Obrigada!",
      photo: "assets/reviews/Luisa Neves.png"
    }
  ];

  function initials(name) {
    return name.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join("")
      .toUpperCase();
  }

  function createCard(review) {
    const card = document.createElement("article");
    card.className = "review-card";

    const header = document.createElement("div");
    header.className = "review-header";

    const photoWrap = document.createElement("div");
    photoWrap.className = "review-photo-link";

    const img = document.createElement("img");
    img.className = "review-photo";
    img.src = review.photo;
    img.alt = `Foto de ${review.name}`;
    img.loading = "lazy";

    img.onerror = () => {
      photoWrap.innerHTML = "";
      const fallback = document.createElement("span");
      fallback.className = "review-avatar-fallback";
      fallback.textContent = initials(review.name);
      photoWrap.appendChild(fallback);
    };

    photoWrap.appendChild(img);

    const user = document.createElement("div");
    user.className = "review-user";

    const name = document.createElement("strong");
    name.textContent = review.name;

    const meta = document.createElement("span");
    meta.textContent = review.meta;

    user.append(name, meta);

    const google = document.createElement("span");
    google.className = "google-icon";
    google.textContent = "G";
    google.setAttribute("aria-label", "Google");

    header.append(photoWrap, user, google);

    const stars = document.createElement("div");
    stars.className = "review-stars";
    stars.textContent = "★★★★★";
    stars.setAttribute("aria-label", "5 de 5 estrelas");

    const text = document.createElement("p");
    text.textContent = review.text;

    card.append(header, stars, text);
    return card;
  }

  reviews.forEach(review => track.appendChild(createCard(review)));

  let currentPage = 0;
  let timer;

  function cardsPerPage() {
    if (window.innerWidth <= 560) return 1;
    if (window.innerWidth <= 900) return 2;
    return 5;
  }

  function pageCount() {
    return Math.max(1, Math.ceil(reviews.length / cardsPerPage()));
  }

  function renderDots() {
    dotsBox.innerHTML = "";
    const total = pageCount();

    for (let i = 0; i < total; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "review-dot";
      dot.setAttribute("aria-label", `Ir para grupo ${i + 1} de ${total}`);
      dot.addEventListener("click", () => goToPage(i));
      dotsBox.appendChild(dot);
    }

    updateDots();
  }

  function updateDots() {
    const total = pageCount();
    currentPage = Math.max(0, Math.min(currentPage, total - 1));

    Array.from(dotsBox.children).forEach((dot, index) => {
      dot.classList.toggle("active", index === currentPage);
    });
  }

  function goToPage(page, smooth = true) {
    const total = pageCount();
    currentPage = (page + total) % total;

    const perPage = cardsPerPage();
    const targetIndex = Math.min(currentPage * perPage, reviews.length - 1);
    const target = track.children[targetIndex];

    if (target) {
      track.scrollTo({
        left: Math.max(0, target.offsetLeft - track.offsetLeft),
        behavior: smooth ? "smooth" : "auto"
      });
    }

    updateDots();
    restartAuto();
  }

  function restartAuto() {
    clearInterval(timer);
    timer = setInterval(() => goToPage(currentPage + 1), 5000);
  }

  prev.addEventListener("click", () => goToPage(currentPage - 1));
  next.addEventListener("click", () => goToPage(currentPage + 1));

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderDots();
      goToPage(Math.min(currentPage, pageCount() - 1), false);
    }, 150);
  });

  renderDots();
  goToPage(0, false);
  restartAuto();
});
