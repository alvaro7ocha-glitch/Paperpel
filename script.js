(function () {
  const track = document.getElementById("reviewsTrack");
  const dotsBox = document.getElementById("reviewDots");
  const prev = document.querySelector(".review-arrow.prev");
  const next = document.querySelector(".review-arrow.next");

  if (!track) return;

  const reviews = [
    {
      name: "Mayana Rodrigues",
      meta: "7 avaliações · 2 semanas atrás",
      text: "Atendimento atencioso e personalizado! Tudo que precisei foi feito super rápido e com a maior qualidade. Indico de olhos fechados 💜",
      photo: "assets/reviews/Mayana Rodrigues.png"
    },
    {
      name: "Maria Maria",
      meta: "1 avaliação · 3 meses atrás",
      text: "Montagem e produção maravilhosas com um preço extremamente acessível!!! Meus parabéns!!",
      photo: null,
      initial: "M"
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
      name: "Luísa Neves",
      meta: "7 avaliações · 5 meses atrás",
      text: "Encomendei uma foto 10x15 e algumas fotos 3x4 e eu amei a qualidade, ficaram muito lindas! Obrigada!",
      photo: "assets/reviews/Luisa Neves.png"
    },
    {
      name: "Iris Valim",
      meta: "1 avaliação · 2 anos atrás",
      text: "Atendimento maravilhoso! Super atenciosos e a qualidade da impressão é ótima! Além da rapidez que o brasileiro aaaaaama!",
      photo: "assets/reviews/Iris Valin.png"
    }
  ];

  function makeCard(review) {
    const card = document.createElement("article");
    card.className = "review-card";

    const header = document.createElement("div");
    header.className = "review-header";

    if (review.photo) {
      const img = document.createElement("img");
      img.className = "review-photo";
      img.src = review.photo;
      img.alt = "Foto de " + review.name;
      img.loading = "lazy";
      img.onerror = function () {
        img.replaceWith(makeFallback(review.name, review.initial));
      };
      header.appendChild(img);
    } else {
      header.appendChild(makeFallback(review.name, review.initial));
    }

    const user = document.createElement("div");
    user.className = "review-user";

    const name = document.createElement("strong");
    name.textContent = review.name;

    const meta = document.createElement("span");
    meta.className = "review-meta";
    meta.textContent = review.meta;

    user.append(name, meta);
    header.appendChild(user);

    const google = document.createElement("span");
    google.className = "google-icon";
    google.textContent = "G";
    header.appendChild(google);

    const stars = document.createElement("div");
    stars.className = "review-stars";
    stars.textContent = "★★★★★";

    const text = document.createElement("p");
    text.textContent = review.text;

    card.append(header, stars, text);
    return card;
  }

  function makeFallback(name, initial) {
    const el = document.createElement("span");
    el.className = "review-avatar-fallback";
    el.textContent = initial || name.trim().charAt(0).toUpperCase();
    return el;
  }

  reviews.forEach(review => track.appendChild(makeCard(review)));

  let current = 0;
  let timer = null;

  function visibleCards() {
    if (window.innerWidth <= 560) return 1;
    if (window.innerWidth <= 900) return 2;
    if (window.innerWidth <= 1050) return 3;
    return 5;
  }

  function pageCount() {
    return Math.max(1, Math.ceil(reviews.length / visibleCards()));
  }

  function buildDots() {
    dotsBox.innerHTML = "";
    const total = pageCount();

    for (let i = 0; i < total; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "review-dot" + (i === current ? " active" : "");
      dot.setAttribute("aria-label", "Ir para grupo de avaliações " + (i + 1));
      dot.addEventListener("click", () => goTo(i));
      dotsBox.appendChild(dot);
    }
  }

  function updateDots() {
    const total = pageCount();
    if (current >= total) current = 0;
    [...dotsBox.children].forEach((dot, i) => dot.classList.toggle("active", i === current));
  }

  function goTo(page) {
    const total = pageCount();
    current = (page + total) % total;

    const cards = [...track.children];
    const index = current * visibleCards();
    const target = cards[index];

    if (target) {
      track.scrollTo({
        left: target.offsetLeft - track.offsetLeft,
        behavior: "smooth"
      });
    }
    updateDots();
  }

  function restartAuto() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 5000);
  }

  prev.addEventListener("click", () => {
    goTo(current - 1);
    restartAuto();
  });

  next.addEventListener("click", () => {
    goTo(current + 1);
    restartAuto();
  });

  window.addEventListener("resize", () => {
    const old = current;
    buildDots();
    current = Math.min(old, pageCount() - 1);
    goTo(current);
  });

  buildDots();
  updateDots();
  restartAuto();
})();
