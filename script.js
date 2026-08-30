(function () {
  const track = document.getElementById("reviewsTrack");
  const prev = document.querySelector(".review-arrow.prev");
  const next = document.querySelector(".review-arrow.next");
  const dotsBox = document.getElementById("reviewDots");
  const scoreEl = document.getElementById("reviewsScore");
  const starsEl = document.getElementById("reviewsStars");
  const countEl = document.getElementById("reviewsCount");
  const placeLink = document.getElementById("googlePlaceLink");

  let cards = [];
  let current = 0;

  function showError(message) {
    track.innerHTML = `<div class="reviews-error">${message}</div>`;
    if (dotsBox) dotsBox.innerHTML = "";
  }

  function loadMapsApi(key) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) return resolve();
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&loading=async&v=weekly";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps."));
      document.head.appendChild(script);
    });
  }

  function stars(rating) {
    const rounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  }

  function createReviewCard(review) {
    const author = review.authorAttribution || {};
    const name = author.displayName || "Cliente do Google";
    const photo = author.photoURI || "";
    const profile = author.uri || review.googleMapsURI || "https://www.google.com/maps";
    const time = review.relativePublishTimeDescription || "";
    const text = review.text || review.originalText || "";

    const card = document.createElement("article");
    card.className = "review-card";

    const header = document.createElement("div");
    header.className = "review-header";

    const photoLink = document.createElement("a");
    photoLink.href = profile;
    photoLink.target = "_blank";
    photoLink.rel = "noopener";
    photoLink.className = "review-photo-link";
    photoLink.setAttribute("aria-label", `Ver perfil de ${name} no Google`);

    if (photo) {
      const img = document.createElement("img");
      img.className = "review-photo";
      img.src = photo;
      img.alt = `Foto de ${name}`;
      img.referrerPolicy = "no-referrer";
      photoLink.appendChild(img);
    } else {
      const avatar = document.createElement("span");
      avatar.className = "review-avatar-fallback";
      avatar.textContent = name.trim().charAt(0).toUpperCase();
      photoLink.appendChild(avatar);
    }

    const user = document.createElement("div");
    user.className = "review-user";
    const nameLink = document.createElement("a");
    nameLink.href = profile;
    nameLink.target = "_blank";
    nameLink.rel = "noopener";
    nameLink.textContent = name;
    const meta = document.createElement("span");
    meta.textContent = time;
    user.append(nameLink, meta);

    const google = document.createElement("span");
    google.className = "google-icon";
    google.textContent = "G";
    google.setAttribute("aria-label", "Google");

    header.append(photoLink, user, google);

    const rating = document.createElement("div");
    rating.className = "review-stars";
    rating.textContent = stars(review.rating);
    rating.setAttribute("aria-label", `${review.rating} de 5 estrelas`);

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    card.append(header, rating, paragraph);
    return card;
  }

  function setupCarousel() {
    cards = Array.from(track.querySelectorAll(".review-card"));
    if (!cards.length) return;

    dotsBox.innerHTML = "";
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
      dots.forEach((dot, index) => dot.classList.toggle("active", index === current));
    }

    function goTo(index) {
      current = (index + cards.length) % cards.length;
      track.scrollTo({ left: cards[current].offsetLeft - track.offsetLeft, behavior: "smooth" });
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
    }, { passive: true });
  }

  async function loadReviews() {
    const key = window.PAPERPEL_GOOGLE_MAPS_API_KEY;
    if (!key || key === "COLE_SUA_CHAVE_AQUI") {
      showError("Configure a chave da Google Maps Platform em <strong>config.js</strong> para ativar as avaliações automáticas.");
      return;
    }

    try {
      await loadMapsApi(key);
      const { Place } = await google.maps.importLibrary("places");

      // Usamos o endereço da Paperpel para localizar o estabelecimento automaticamente.
      const search = await Place.searchByText({
        textQuery: "Paperpel, Av. Bernarda Silvestre, 410, Belo Horizonte, MG",
        fields: ["id", "displayName", "formattedAddress"],
        maxResultCount: 5,
        language: "pt-BR",
        region: "BR"
      });

      const placeResult = (search.places || []).find(p => /paperpel/i.test(p.displayName || "")) || search.places?.[0];
      if (!placeResult?.id) throw new Error("A Paperpel não foi localizada pelo Google Places.");

      const place = new Place({ id: placeResult.id });
      await place.fetchFields({
        fields: ["displayName", "rating", "userRatingCount", "reviews", "googleMapsURI", "attributions"]
      });

      const rating = Number(place.rating || 0);
      scoreEl.textContent = rating.toFixed(1).replace(".", ",");
      starsEl.textContent = stars(rating);
      starsEl.setAttribute("aria-label", `${rating.toFixed(1).replace(".", ",")} estrelas`);
      countEl.textContent = `${place.userRatingCount || 0} avaliações no Google`;
      if (place.googleMapsURI) placeLink.href = place.googleMapsURI;

      // A API fornece até 5 avaliações. Exibimos apenas as que são realmente 5 estrelas.
      const reviews = (place.reviews || []).filter(review => Number(review.rating) === 5);
      track.innerHTML = "";

      if (!reviews.length) {
        showError("Não encontramos avaliações de 5 estrelas disponíveis no Google no momento.");
        return;
      }

      reviews.forEach(review => track.appendChild(createReviewCard(review)));
      setupCarousel();
    } catch (error) {
      console.error(error);
      showError("Não foi possível carregar as avaliações do Google agora. Verifique a chave e as APIs ativadas no Google Cloud.");
    }
  }

  loadReviews();
})();
