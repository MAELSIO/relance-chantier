/* =========================================================
   TÉMOIGNAGES — moteur d'affichage partagé (identique sur
   Facilo et Relance Chantier, pour faciliter la maintenance).

   Ne contient AUCUNE donnée : lit le tableau qu'on lui passe
   et génère les cartes. Si le tableau est vide, la section
   correspondante est masquée — jamais de faux témoignage
   affiché à un visiteur.

   Utilisation (voir bas de index.html) :
     renderTestimonials(window.MA_LISTE_DE_TEMOIGNAGES, {
       sectionId: 'temoignages',      // élément à masquer si vide
       containerId: 'testimonialsList', // conteneur des cartes
       org: { name: 'Nom du site', url: 'https://...' } // pour schema.org
     });
   ========================================================= */
(function () {
  "use strict";

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function starsMarkup(note) {
    if (typeof note !== 'number' || note < 1 || note > 5) return '';
    var full = Math.round(note);
    return '<div class="testimonial-stars" aria-label="Note : ' + full + ' sur 5">' +
      '★'.repeat(full) + '☆'.repeat(5 - full) +
      '</div>';
  }

  function cardMarkup(t) {
    var initial = t.prenom ? t.prenom.charAt(0).toUpperCase() : '?';
    var photo = t.photo
      ? '<img class="testimonial-photo" src="' + escapeHtml(t.photo) + '" alt="Photo de ' + escapeHtml(t.prenom || '') + '" loading="lazy">'
      : '<span class="testimonial-avatar" aria-hidden="true">' + escapeHtml(initial) + '</span>';
    var meta = [t.role, t.ville].filter(Boolean).map(escapeHtml).join(', ');
    var source = t.lienSource
      ? '<a class="testimonial-source" href="' + escapeHtml(t.lienSource) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(t.lienLabel || "Voir l'avis original") + ' ↗</a>'
      : '';
    return (
      '<div class="testimonial">' +
        starsMarkup(t.note) +
        '<blockquote class="testimonial-quote">' + escapeHtml(t.citation) + '</blockquote>' +
        '<div class="testimonial-who">' +
          photo +
          '<div><div class="testimonial-name">' + escapeHtml(t.prenom) + '</div>' +
          '<div class="testimonial-meta">' + meta + '</div></div>' +
        '</div>' +
        source +
      '</div>'
    );
  }

  function schemaFor(entries, org) {
    var reviews = entries.map(function (t) {
      var r = {
        "@type": "Review",
        "author": { "@type": "Person", "name": t.prenom },
        "reviewBody": t.citation
      };
      if (typeof t.note === 'number') {
        r.reviewRating = { "@type": "Rating", "ratingValue": t.note, "bestRating": 5 };
      }
      return r;
    });
    var noted = entries.filter(function (t) { return typeof t.note === 'number'; });
    var schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": org.name,
      "url": org.url,
      "review": reviews
    };
    if (noted.length) {
      var avg = noted.reduce(function (s, t) { return s + t.note; }, 0) / noted.length;
      schema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": Math.round(avg * 10) / 10,
        "reviewCount": noted.length
      };
    }
    return schema;
  }

  window.renderTestimonials = function (entries, opts) {
    var wrapper = opts.sectionId ? document.getElementById(opts.sectionId) : null;
    var container = document.getElementById(opts.containerId);
    if (!container) return;

    if (!entries || !entries.length) {
      if (wrapper) wrapper.style.display = 'none';
      return;
    }

    container.innerHTML = entries.map(cardMarkup).join('');

    if (opts.org) {
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schemaFor(entries, opts.org));
      document.head.appendChild(script);
    }
  };
})();
