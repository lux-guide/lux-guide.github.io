# -*- coding: utf-8 -*-
"""
Temps de route et distance routière jusqu'à Luxembourg-Ville, pour les communes
frontalières, calculés une fois à la construction et rangés dans un cache.

Pourquoi ce fichier à part. La distance à vol d'oiseau ne sert à rien pour
choisir où habiter : elle ignore la Moselle, les crêtes de l'Eifel et le fait
qu'une autoroute passe ou non. Deux communes à vingt kilomètres du Kirchberg
peuvent être à vingt minutes ou à quarante. Le service public OSRM répond à
cette question, mais lentement et par paquets : on l'appelle donc au moment de
construire la base, jamais depuis le navigateur du visiteur.

Limite à dire, et qui est dite dans l'aide de l'indicateur : OSRM calcule un
trajet à vitesse libre, sans embouteillage. Le matin vers le Luxembourg, les
axes saturent, et l'écart réel est plus grand que celui affiché. Le chiffre
sert à classer les communes entre elles, pas à prévoir une heure d'arrivée.
"""
import io, json, os, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
FICHIER = os.path.join(CACHE, "trajets.json")

# Luxembourg-Ville, place d'Armes.
LUX = (49.6113, 6.1292)
OSRM = "https://router.project-osrm.org/table/v1/driving/%s?sources=%s&destinations=0&annotations=duration,distance"
PAQUET = 80


def charger():
    if os.path.exists(FICHIER):
        return json.load(io.open(FICHIER, encoding="utf-8"))
    return {}


def sauver(d):
    os.makedirs(CACHE, exist_ok=True)
    io.open(FICHIER, "w", encoding="utf-8", newline="").write(
        json.dumps(d, ensure_ascii=False))


def trajets(zones):
    """Rend {clé: (minutes, km)} pour les zones données.

    La clé est le code de la commune. Les résultats déjà calculés sont
    conservés d'une construction à l'autre : le service est public et lent, il
    n'y a aucune raison de lui redemander deux fois la même chose.
    """
    deja = charger()
    reste = [z for z in zones if z["lau"] not in deja]
    print("   %d trajets en cache, %d à calculer" % (len(deja), len(reste)))
    for i in range(0, len(reste), PAQUET):
        lot = reste[i:i + PAQUET]
        coords = ["%f,%f" % (LUX[1], LUX[0])]
        for z in lot:
            coords.append("%f,%f" % (z["c"][1], z["c"][0]))
        sources = ";".join(str(j + 1) for j in range(len(lot)))
        url = OSRM % (";".join(coords), sources)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "lux_guide build_frontaliers"})
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("   lot %d : échec %s" % (i // PAQUET + 1, str(e)[:70]))
            time.sleep(3)
            continue
        if d.get("code") != "Ok":
            print("   lot %d : réponse %s" % (i // PAQUET + 1, d.get("code")))
            continue
        for j, z in enumerate(lot):
            sec = d["durations"][j][0]
            met = d["distances"][j][0]
            if sec is None or met is None:
                continue
            deja[z["lau"]] = [round(sec / 60.0, 1), round(met / 1000.0, 1)]
        print("   lot %d sur %d fait" % (i // PAQUET + 1, (len(reste) + PAQUET - 1) // PAQUET))
        sauver(deja)
        time.sleep(1.5)
    return deja
