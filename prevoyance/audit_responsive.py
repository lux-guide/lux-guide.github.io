# -*- coding: utf-8 -*-
# Audit responsive mesure : six familles de defauts, treize largeurs, quatre
# etats. Ce qui se juge a l'oeil se rate a l'oeil, et un ecran de bureau ne
# ment jamais autant que sur un telephone.
#
#   python -m http.server 8932 --directory prevoyance
#   python prevoyance/audit_responsive.py
#
# Il complete test_prevoyance.py, qui verifie les regles de fond. Celui-ci ne
# verifie que la forme, et il s'arrete au premier chiffre qui depasse.
from playwright.sync_api import sync_playwright
import sys

U = "http://localhost:8932/index.html"
LARGEURS = [320, 360, 375, 390, 414, 600, 768, 820, 1024, 1180, 1280, 1440, 1680]
VUES = ["", "#simulateur", "#questions"]

MESURE = """() => {
  const out = { deborde: [], petit: [], cible: [], longue: [], colle: [], coupe: [] };
  const vp = innerWidth;

  // 1. Rien ne pousse la page horizontalement.
  if (document.documentElement.scrollWidth > vp + 1) out.deborde.push('la page entiere');
  document.querySelectorAll('main *, .panneau *, .pied *').forEach(e => {
    if (!e.offsetParent) return;
    const r = e.getBoundingClientRect();
    if (r.width > 0 && (r.right > vp + 1 || r.left < -1)) {
      const p = e.parentElement;
      const pr = p ? p.getBoundingClientRect() : null;
      // On ne signale que le premier fautif d'une chaine, pas ses enfants.
      const ps = p ? getComputedStyle(p) : null;
      const cadreDefile = ps && (ps.overflowX === 'auto' || ps.overflowX === 'scroll');
      if (!cadreDefile && (!pr || (pr.right <= vp + 1 && pr.left >= -1))) {
        out.deborde.push(e.tagName.toLowerCase() + '.' + e.className + ' (' + Math.round(r.right) + ')');
      }
    }
  });

  document.querySelectorAll('p, li, td, th, label, a, button, summary, h1, h2, h3, span').forEach(e => {
    if (!e.offsetParent) return;
    const t = (e.innerText || '').trim();
    if (!t) return;
    const s = getComputedStyle(e);
    const px = parseFloat(s.fontSize);

    // 2. Rien sous 12 px : en dessous, on n'ecrit plus, on decore.
    const plancher = matchMedia('(pointer: coarse)').matches ? 12 : 11;
    if (px < plancher && e.children.length === 0) out.petit.push(px + 'px « ' + t.slice(0, 28) + ' »');

    // 3. Une cible du doigt fait 44 px.
    if (/^(A|BUTTON|SUMMARY)$/.test(e.tagName) && e.children.length < 3) {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.height < 40 && matchMedia('(pointer: coarse)').matches) {
        out.cible.push(Math.round(r.height) + 'px « ' + t.slice(0, 26) + ' »');
      }
    }

    // 4. Une ligne de plus de 90 caracteres se relit mal ; on mesure la
    //    ligne rendue, pas le texte, car le retour a la ligne depend de tout.
    if (/^(P|LI|TD)$/.test(e.tagName) && e.children.length === 0 && t.length > 90) {
      const rg = document.createRange();
      rg.selectNodeContents(e);
      const l = [...rg.getClientRects()].filter(r => r.height > 4);
      if (l.length) {
        const large = Math.max(...l.map(r => r.width));
        const car = Math.round(t.length / l.length);
        if (car > 96) out.longue.push(car + ' car/ligne « ' + t.slice(0, 26) + ' »');
      }
    }
  });

  // 5. Deux blocs voisins qui se touchent ou se chevauchent.
  const cartes = [...document.querySelectorAll('.card, .qcard, .kpi, .graphe-bloc')].filter(e => e.offsetParent);
  for (let i = 0; i < cartes.length; i++) {
    for (let j = i + 1; j < cartes.length; j++) {
      const a = cartes[i].getBoundingClientRect(), b = cartes[j].getBoundingClientRect();
      const chev = a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
      if (chev) out.colle.push(cartes[i].className + ' / ' + cartes[j].className);
    }
  }

  // 6. Un texte coupe par son conteneur.
  document.querySelectorAll('main *, .panneau *').forEach(e => {
    if (!e.offsetParent || e.children.length) return;
    // Un libelle cache pour le lecteur d'ecran fait 1 px par construction.
    if (e.classList.contains('visuellement-cache')) return;
    const s = getComputedStyle(e);
    if (s.overflow === 'visible' && s.overflowX === 'visible') return;
    if (e.scrollWidth > e.clientWidth + 2 && s.overflowX !== 'auto' && s.overflowX !== 'scroll') {
      out.coupe.push(e.tagName.toLowerCase() + '.' + e.className);
    }
  });

  for (const k in out) out[k] = [...new Set(out[k])];
  return out;
}"""

total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in LARGEURS:
        coarse = w <= 820
        c = b.new_context(viewport={"width": w, "height": 820},
                          has_touch=coarse, is_mobile=coarse)
        pg = c.new_page()
        for vue in VUES:
            for volet in ([False, True] if vue == "" else [False]):
                pg.goto(U + vue)
                pg.wait_for_timeout(450)
                if volet:
                    pg.click("#assistant-btn")
                    pg.wait_for_timeout(450)
                m = pg.evaluate(MESURE)
                n = sum(len(v) for v in m.values())
                total += n
                if n:
                    print("%4d px %-12s %s" % (w, vue or "#accueil", "volet ouvert" if volet else ""))
                    for k, v in m.items():
                        for x in v[:4]:
                            print("       %-8s %s" % (k, x))
        c.close()
    b.close()

print()
print("TOTAL :", total, "defauts" if total else "aucun defaut")
sys.exit(1 if total else 0)
