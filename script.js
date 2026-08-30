document.addEventListener("DOMContentLoaded", () => {
  const track = document.getElementById("reviewsTrack");
  const prev = document.querySelector(".review-arrow.prev");
  const next = document.querySelector(".review-arrow.next");
  const dotsBox = document.getElementById("reviewDots");

  /*
    Avaliações cadastradas manualmente.
    As fotos são lidas diretamente de assets/reviews/.
    Para trocar uma foto, basta substituir o arquivo mantendo o mesmo nome.
  */
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

  let currentPage = 0;
  let pageCount = 1;

  const initials = (name) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();

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

    const rating = document.createElement("div");
    rating.className = "review-stars";
    rating.textContent = "★★★★★";
    rating.setAttribute("aria-label", "5 de 5 estrelas");

    const text = document.createElement("p");
    text.textContent = review.text;

    card.append(header, rating, text);
    return card;
  }

  function cardsPerPage() {
    return window.innerWidth <= 760 ? 1 : 3;
  }

  function render() {
    const perPage = cardsPerPage();
    pageCount = Math.ceil(reviews.length / perPage);
    currentPage = Math.min(currentPage, pageCount - 1);

    track.innerHTML = "";
    reviews.forEach(review => track.appendChild(createCard(review)));

    dotsBox.innerHTML = "";
    for (let i = 0; i < pageCount; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "review-dot" + (i === currentPage ? " active" : "");
      dot.setAttribute("aria-label", `Ir para página ${i + 1} das avaliações`);
      dot.addEventListener("click", () => goTo(i));
      dotsBox.appendChild(dot);
    }

    requestAnimationFrame(() => goTo(currentPage, false));
  }

  function goTo(page, smooth = true) {
    const perPage = cardsPerPage();
    pageCount = Math.ceil(reviews.length / perPage);
    currentPage = (page + pageCount) % pageCount;

    const targetIndex = currentPage * perPage;
    const target = track.children[targetIndex];
    if (target) {
      track.scrollTo({
        left: target.offsetLeft - track.offsetLeft,
        behavior: smooth ? "smooth" : "auto"
      });
    }

    [...dotsBox.children].forEach((dot, i) =>
      dot.classList.toggle("active", i === currentPage)
    );
  }

  prev.addEventListener("click", () => goTo(currentPage - 1));
  next.addEventListener("click", () => goTo(currentPage + 1));

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  render();
});
