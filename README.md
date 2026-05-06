# Aftensmad

En simpel offline aftensmads-opskriftsapp — ren HTML/CSS/JS, ingen build.

Du kan tilføje opskrifter på to måder:

- **Skriv selv** — titel, beskrivelse, ingredienser og fremgangsmåde.
- **Link til opskrift** — titel, beskrivelse og en URL til opskriften et andet
  sted på nettet.

Opskrifter gemmes i browserens `localStorage`. Brug **Eksportér** / **Importér**
i menuen til at flytte dem mellem enheder eller tage backup.

## Kør lokalt

Du kan åbne `index.html` direkte i en browser, men **funktionen "Hent fra link"
virker ikke når siden åbnes via `file://`** — browsere blokerer CORS-requests
fra `file://` origins. Brug en lokal HTTP-server:

```sh
python -m http.server 8000
# åbn http://localhost:8000
```

Ingen `npm install`, ingen build. På GitHub Pages eller en hvilken som helst
HTTPS-host virker URL-import som forventet.

## Deploy til GitHub Pages

1. Push dette repo til GitHub.
2. **Settings → Pages → Source**: vælg `Deploy from branch`, branch `main`,
   folder `/` (root).
3. Siden bliver live på `https://<dit-brugernavn>.github.io/<repo>/`.

`.nojekyll` er inkluderet, så GitHub springer Jekyll-behandlingen over.

## Filstruktur

```
index.html     # App-skal
styles.css     # Stilark
app.js         # Al logik (storage, routing, views, export/import)
.nojekyll      # Slår Jekyll fra på GitHub Pages
```
