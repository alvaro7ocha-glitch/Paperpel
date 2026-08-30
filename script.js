const track = document.getElementById("reviewsTrack");
const prev = document.querySelector(".review-arrow.prev");
const next = document.querySelector(".review-arrow.next");
const dotsBox = document.getElementById("reviewDots");

if (track && prev && next && dotsBox) {
  const cards = Array.from(track.querySelectorAll(".review-card"));
  let current = 0;

  cards.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "review-dot" + (index === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Ir para avaliação ${index + 1}`);
    dot.addEventListener("click", () => goTo(index));
    dotsBox.appendChild(dot);
  });

  const dots = Array.from(dotsBox.querySelectorAll(".review-dot"));

  function updateDots() {
    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === current);
    });
  }

  function goTo(index) {
    current = (index + cards.length) % cards.length;
    cards[current].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start"
    });
    updateDots();
  }

  next.addEventListener("click", () => goTo(current + 1));
  prev.addEventListener("click", () => goTo(current - 1));

  track.addEventListener("scroll", () => {
    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const d = Math.abs(card.offsetLeft - track.scrollLeft);
      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    current = closest;
    updateDots();
  });
}
