# SpanishBoys Quiz 🌮

Live-Quiz (wie Kahoot) für die Spanisch-Präsentation „La comida mexicana“.
Schüler scannen den QR-Code, antworten auf dem Handy – die Frage läuft auf dem Beamer.

- **Beamer / Host:** `/host` (Passwort nötig)
- **Handy / Schüler:** `/` (Startseite)

## Lokal starten

```bash
npm install
npm start
```

Dann im Browser `http://localhost:3000/host` öffnen. Standard-Passwort lokal: **comida**.
Handys im selben WLAN können nur mitspielen, wenn du `/host` über die Netzwerk-Adresse des Laptops öffnest
(z. B. `http://192.168.0.23:3000/host`) – der QR-Code übernimmt automatisch die Adresse, mit der du die Seite geöffnet hast.
Für die Klasse ist die Online-Variante einfacher (siehe unten).

## Online stellen (Render.com, kostenlos)

1. **GitHub-Konto** anlegen (github.com), falls noch keins da ist.
2. Neues **Repository** erstellen („New repository“), Name z. B. `spanishboys-quiz`, auf *Public* oder *Private*. Ohne README anlegen.
3. Den **Projektordner hochladen**. Am einfachsten im Terminal im Projektordner:
   ```bash
   git init
   git add .
   git commit -m "SpanishBoys Quiz"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/spanishboys-quiz.git
   git push -u origin main
   ```
   (Ohne Terminal: Im neuen Repository „uploading an existing file“ wählen und alle Dateien **außer** `node_modules` hineinziehen.)
4. Auf **render.com** ein Konto anlegen („Get Started“ → mit GitHub anmelden).
5. **New + → Blueprint** wählen, das Repository auswählen. Render liest `render.yaml` automatisch.
   (Alternative: **New + → Web Service**, Repository wählen, *Build Command:* `npm install`, *Start Command:* `npm start`, *Instance Type:* **Free**.)
6. Beim Einrichten nach **HOST_PASSWORD** gefragt → ein eigenes Passwort eintragen (siehe unten). Dann **Apply / Create Web Service**.
7. Nach 2–3 Minuten steht oben die Adresse, z. B. `https://spanishboys-quiz.onrender.com`.
   - Schüler: diese Adresse (oder der QR-Code)
   - Du: `https://spanishboys-quiz.onrender.com/host`

Der **QR-Code** entsteht automatisch aus der Adresse, über die du `/host` geöffnet hast – nichts einzustellen.

> ⚠️ **Der kostenlose Server schläft ein.** Nach ca. 15 Minuten ohne Besucher schläft er, und der erste Aufruf dauert dann bis zu einer Minute.
> **Öffne die Seite `/host` deshalb einige Minuten vor der Stunde einmal**, damit der Server wach ist.
> Außerdem: Wird der Server neu gestartet (z. B. nach einem Update), sind alle Spieler und Punkte weg – der Spielstand liegt nur im Arbeitsspeicher.

## Host-Passwort setzen

- **Auf Render:** Dein Service → *Environment* → Variable `HOST_PASSWORD` setzen → Speichern (Render startet neu).
- **Lokal:**
  ```bash
  HOST_PASSWORD=meinpasswort npm start
  ```
- Ohne Variable gilt das Standard-Passwort `comida`. **Online unbedingt ein eigenes setzen**, sonst kann jeder, der `/host` kennt, das Spiel steuern.

## Fragen ändern

Alle Fragen stehen in `questions.json`:

```json
{
  "question": "¿Qué fruta lleva el taco al pastor?",
  "answers": ["manzana", "piña", "plátano", "fresa"],
  "correct": 1
}
```

- `answers`: 2 bis 4 Antworten. `correct` ist die **Nummer der richtigen Antwort, gezählt ab 0** (0 = erste, 1 = zweite, …).
- Die Reihenfolge der Antworten wird bei jeder Frage zufällig gemischt.
- Nach dem Ändern: lokal Server neu starten; online die Datei zu GitHub hochladen (`git commit` + `git push`), Render aktualisiert automatisch.
- Fehler in der Datei meldet der Server beim Start.

## Ablauf & Punkte

1. Lobby: Spieler scannen den QR-Code und geben einen Spitznamen ein (max. 15 Zeichen, keine doppelten Namen). Mit **×** wirfst du unpassende Namen raus.
2. **¡Empezar!** → Frage mit 20 Sekunden Zeit. Sie endet früher, wenn alle geantwortet haben.
3. Auflösung (richtige Antwort + Balken) → **Ranking →** → Top 5 → **Siguiente →**. (Tastatur: Leertaste/Enter = weiter.)
4. Nach der letzten Frage: Siegerpodest mit Konfetti. **Jugar otra vez** setzt die Punkte zurück (die Spieler bleiben).

**Punkte pro Frage (0–10):** Falsch oder keine Antwort = 0. Die erste richtige Antwort = 10. Alle weiteren richtigen: `5 + 5 × (Restzeit / 20 s)`, gerundet (5–10).
Die Zeit misst der **Server**. Bei Punktgleichstand gewinnt, wer insgesamt schneller geantwortet hat.
Wer später beitritt, spielt ab der nächsten Frage mit. Wer das Handy sperrt oder die Seite neu lädt, kommt automatisch zurück (Token im `localStorage`).

## Datenschutz

Es werden nur Spitznamen verwendet. Alles liegt nur im Arbeitsspeicher des Servers, keine Datenbank, keine Cookies; im Handy wird nur ein zufälliger Wiederverbindungs-Token im `localStorage` abgelegt.

## Technik

Node.js, Express, Socket.IO, `qrcode`. Kein Build-Schritt. `PORT` kommt aus der Umgebung (Render setzt ihn selbst). Optional: `PUBLIC_URL` erzwingt eine feste Adresse für den QR-Code.
