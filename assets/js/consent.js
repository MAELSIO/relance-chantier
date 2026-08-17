/* =========================================================
   RELANCE CHANTIER — bandeau de consentement cookies (partagé).

   GoatCounter (ci-dessous dans le <head>) est cookieless et sans
   identifiant individuel : il reste actif sans consentement,
   conformément à l'exemption CNIL (délibération 2020-091).

   Google Analytics 4 dépose des cookies (_ga, _ga_*) et N'EST PAS
   exempté : ce script ne le charge JAMAIS avant un clic explicite
   sur "Accepter" dans le bandeau ci-dessous.
   ========================================================= */
var RC_GA_ID = 'G-48Y5HW2GTY';
var RC_CONSENT_KEY = 'rc_consent';

function rcLoadGA4(){
  if (window.gtag) return; // déjà chargé
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + RC_GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', RC_GA_ID);
}

/* Supprime les cookies GA déjà déposés (cas d'un refus après un accord
   précédent, via "Gérer mes préférences cookies"). */
function rcPurgeGA4Cookies(){
  document.cookie.split(';').forEach(function(c){
    var name = c.split('=')[0].trim();
    if (/^_ga/.test(name)){
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + location.hostname + ';';
    }
  });
}

/* Bouton "Gérer mes préférences cookies" (page cookies.html) : efface
   le choix mémorisé et recharge la page pour réafficher le bandeau. */
window.rcOpenCookieSettings = function(){
  localStorage.removeItem(RC_CONSENT_KEY);
  location.reload();
};

(function initCookieBanner(){
  var existing = localStorage.getItem(RC_CONSENT_KEY);
  if (existing){
    if (existing === 'accept') rcLoadGA4();
    return;
  }

  var base = (function(){
    var el = document.currentScript;
    var src = el && el.getAttribute('src');
    if (!src) return '';
    return src.replace(/assets\/js\/consent\.js(\?.*)?$/, '');
  })();

  var banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Consentement cookies');
  banner.innerHTML =
    '<div class="cookie-inner">' +
      '<p class="cookie-text">Nous utilisons GoatCounter (sans cookie) pour la mesure d\'audience de base. ' +
      'Avec votre accord, nous utilisons aussi Google Analytics pour mieux comprendre l\'usage du site. ' +
      '<a href="' + base + 'confidentialite.html">En savoir plus</a></p>' +
      '<div class="cookie-actions">' +
        '<button type="button" class="btn btn-ghost" data-consent="refuse">Refuser</button>' +
        '<button type="button" class="btn btn-primary" data-consent="accept">Accepter</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(banner);
  requestAnimationFrame(function(){ banner.classList.add('show'); });

  banner.querySelectorAll('[data-consent]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var choice = btn.getAttribute('data-consent');
      localStorage.setItem(RC_CONSENT_KEY, choice);
      if (choice === 'accept'){
        rcLoadGA4();
      } else {
        rcPurgeGA4Cookies();
      }
      banner.classList.remove('show');
      setTimeout(function(){ banner.remove(); }, 350);
    });
  });
})();
