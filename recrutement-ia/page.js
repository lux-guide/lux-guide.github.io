// Le sommaire suit la lecture : la section qui occupe le haut de l'écran est
// marquée, et sur téléphone la ligne du sommaire défile jusqu'à elle.
(function () {
  "use strict";
  var liens = Array.prototype.slice.call(document.querySelectorAll(".sommaire a"));
  if (!liens.length || !("IntersectionObserver" in window)) return;
  var parId = {};
  liens.forEach(function (a) { parId[a.getAttribute("href").slice(1)] = a; });

  function marquer(id) {
    liens.forEach(function (a) { a.classList.toggle("on", a === parId[id]); });
    var a = parId[id], nav = a && a.parentNode;
    if (nav && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
    }
  }

  var visibles = {};
  var obs = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) { visibles[e.target.id] = e.isIntersecting; });
    var premier = Object.keys(parId).filter(function (id) { return visibles[id]; })[0];
    if (premier) marquer(premier);
  }, { rootMargin: "-15% 0px -70% 0px" });
  Object.keys(parId).forEach(function (id) {
    var s = document.getElementById(id);
    if (s) obs.observe(s);
  });
})();
