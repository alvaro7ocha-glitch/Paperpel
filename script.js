document.addEventListener("DOMContentLoaded", () => {
  const track = document.getElementById("reviewsTrack");
  const prev = document.querySelector(".review-arrow.prev");
  const next = document.querySelector(".review-arrow.next");
  const dotsBox = document.getElementById("reviewDots");

  if (!track || !prev || !next || !dotsBox) return;

  const cards = Array.from(track.querySelectorAll(".review-card"));
  let current = 0;
  let timer;

  function cardsPerPage() {
    if (window.innerWidth <= 560) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
  }

  function pageCount() {
    return Math.ceil(cards.length / cardsPerPage());
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
    current = Math.max(0, Math.min(current, total - 1));

    Array.from(dotsBox.children).forEach((dot, index) => {
      dot.classList.toggle("active", index === current);
    });
  }

  function goToPage(page, smooth = true) {
    const perPage = cardsPerPage();
    const total = pageCount();

    current = (page + total) % total;

    const targetIndex = Math.min(current * perPage, cards.length - 1);
    const target = cards[targetIndex];

    if (target) {
      track.scrollTo({
        left: Math.max(0, target.offsetLeft - track.offsetLeft),
        behavior: smooth ? "smooth" : "auto"
      });
    }

    updateDots();
    restartAuto();
  }

  function goNext() {
    goToPage(current + 1);
  }

  function goPrev() {
    goToPage(current - 1);
  }

  function restartAuto() {
    clearInterval(timer);
    timer = setInterval(goNext, 5000);
  }

  next.addEventListener("click", goNext);
  prev.addEventListener("click", goPrev);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderDots();
      goToPage(Math.min(current, pageCount() - 1), false);
    }, 150);
  });

  track.addEventListener("scroll", () => {
    const perPage = cardsPerPage();
    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const d = Math.abs(card.offsetLeft - track.scrollLeft);
      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    current = Math.floor(closest / perPage);
    updateDots();
  });

  renderDots();
  goToPage(0, false);
  restartAuto();
});
