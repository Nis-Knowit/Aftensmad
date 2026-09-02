# Aftensmad

En simpel offline aftensmads-opskriftsapp — ren HTML/CSS/JS, ingen build.

Du kan tilføje opskrifter på to måder:

- **Skriv selv** — titel, beskrivelse, ingredienser og fremgangsmåde.
- **Link til opskrift** — titel, beskrivelse og en URL til opskriften et andet
  sted på nettet.

Opskrifter gemmes i browserens `localStorage`. Brug **Eksportér** / **Importér**
i menuen til at flytte dem mellem enheder eller tage backup.

- **Spørg kokken** — en AI-chat der kender dine gemte opskrifter og foreslår
  nye retter ud fra dem.

Opskrifter gemmes i browserens `localStorage`. Brug **Eksportér** / **Importér**
i menuen til at flytte dem mellem enheder eller tage backup.

## Spørg kokken (Google Gemini)

Knappen **Kok** i toplinjen åbner en chat med Google Gemini. Appen sender dine
gemte opskrifter med som kontekst, så forslagene passer til hvad I plejer at
spise. Du kan skrive fx "aftensmad i aften med kikærter og ris", og kokken
svarer med et eller flere forslag. Hvert forslag kan du enten **videreudvikle**
("gør den mildere og tilføj kylling") eller **gemme i opskrifter** — så bliver
den lagt ind i samlingen i appens eget format, med ingredienser der tæller med i
indkøbslisten.

Opskrifter der kommer fra kokken markeres med et **AI**-mærke på listen og en
note på opskriftssiden. Tjek altid mængder og tilberedning før du følger dem.

### API-nøgle

Kokken kræver en Gemini API-nøgle. Opret en på
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) og indsæt den
under **⋯ → AI-indstillinger**.

Nøglen gemmes kun i `localStorage` i den enkelte browser. Den er med vilje
**ikke** lagt i koden og bliver hverken eksporteret eller synkroniseret til
GitHub: repoet er offentligt, så en nøgle i koden ville kunne misbruges af
andre. Det betyder også at nøglen skal indsættes én gang pr. enhed — også på
telefonen.

Nøglen sendes fra browseren direkte til Googles API. Der er ingen server
imellem, så den er synlig i browserens netværkslog på din egen enhed. Bliver
den kompromitteret, kan du slette den i Google AI Studio og indsætte en ny.

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
app.js         # Al logik (storage, routing, views, sync, AI-kok, export/import)
sw.js          # Service worker (offline-cache)
manifest.webmanifest  # PWA-manifest
data/          # Synkroniseret opskriftsfil (GitHub-sync)
.nojekyll      # Slår Jekyll fra på GitHub Pages
```

Kokken virker på GitHub Pages og i appen på telefonen (installeret via
"Tilføj til hjemmeskærm"), men den kræver netforbindelse. Resten af appen —
opskrifter, søgning og indkøbsliste — virker offline som før.
