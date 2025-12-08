# 🎭 Imposter Spiel — Online-Multiplayer

Ein innovatives Online-Multiplayer-Spiel für Schulklassen und Gruppen. Basierend auf dem beliebten Spielkonzept "Among Us" — mit Rollen wie Impostor, Detektiv, Seherin und Crew.

---

## 📋 Übersicht

**Imposter Spiel** ist ein Web-basiertes Echtzeit-Multiplayer-Spiel, bei dem:
- **6 oder mehr Spieler** sich in virtuellen Lobbys treffen
- **Rollen** zufällig vergeben werden: 4 × Impostor, 1 × Detektiv, 1 × Seherin, Rest Crew
- **Impostor** versuchen, Crewmitglieder zu eliminieren, ohne entdeckt zu werden
- **Detektiv** erhält nach Meldung einer Leiche Hinweise (3 Verdächtige)
- **Seherin** kann einmal die Rolle einer Person aufdecken
- **Crew** arbeitet zusammen, um Impostoren zu finden und abzustimmen
- **IRL-Spielweise:** Bewegung und Diskussion real, Meldung/Voting über App

---

## 🚀 Schnellstart

### Online spielen (kostenlos)
1. Browser öffnen und folgende URL eingeben:
   ```
   https://dc3dda86-3f09-419b-b3a0-d38892b14685-00-30ovlh7jrhuuz.picard.replit.dev/
   ```
2. **Namen eingeben** und „Lobby erstellen" oder „Beitreten" wählen
3. 6 Spieler warten, bis Host „Spiel starten" klickt
4. **Rollen** werden zugewiesen → Spiel beginnt!

### Lokal testen (Entwickler)
```bash
cd project
npm install
npm start
```
Dann im Browser: `http://localhost:8080`

---

## 🎮 Spielregeln

### Rollen & Fähigkeiten

| Rolle | Anzahl | Aufgabe | Besonderheit |
|-------|--------|---------|-------------|
| **Impostor** | 4 | Andere töten, ohne erwischt zu werden | Klickt auf Spieler zum Töten |
| **Detektiv** | 1 | Impostoren aufdecken | Erhält 3 Verdächtige nach Report |
| **Seherin** | 1 | Rolle eines Spielers aufdecken | 1× Fähigkeit (nicht wiederholbar) |
| **Crew** | n | Mit Detektiv zusammenarbeiten | Meldet Leichen, stimmt ab |

### Spielablauf
1. **Spielstart:** Host klickt „Spiel starten" (mindestens 6 Spieler)
2. **Rollen zugewiesen:** Jeder sieht nur seine Rolle (privat)
3. **Aktive Phase:** IRL Bewegung & Diskussion
4. **Leichenmeldung:** Jeder kann „Leiche melden (Report)" klicken
5. **Detektiv-Hinweis:** Detektiv erhält 3 Namen (mindestens 1 Impostor dabei)
6. **Abstimmung:** Alle Spieler wählen, wen hinrichten (Majority Vote)
7. **Ergebnis:** Abgestimmter Spieler wird eliminiert
8. **Wiederholung:** Bis Impostoren gewonnen (zu viele) oder Crew gesiegt (alle Impostoren raus)

---

## 🛠️ Installation & Hosting

### Anforderungen
- Node.js 18.x
- npm 8.x oder höher

### Lokal installieren
```bash
git clone https://github.com/SemaIstek/imposter_spiel.git
cd imposter_spiel/project
npm install
npm start
```
Server läuft auf `http://localhost:8080`

### Online hosten (Replit kostenlos)
1. https://replit.com → Sign up (GitHub)
2. „+ Create Repl" → „Import from GitHub"
3. GitHub URL: `https://github.com/SemaIstek/imposter_spiel`
4. Replit lädt Projekt → „Run" Klick
5. Replit gibt öffentliche URL aus → Spieler öffnen diese URL

### Alternative Hosting-Optionen
- **Glitch.com:** Kostenlos, WebSocket-Support
- **Fly.io:** Kostenlos, CLI-basiert
- **Vercel/Netlify:** Nur Frontend (kein Backend WebSocket)

---

## 📁 Projektstruktur

```
imposter_spiel/
├── project/
│   ├── server.js          # Express + WebSocket Server
│   ├── package.json       # Dependencies (express, ws)
│   ├── public/
│   │   ├── index.html     # Spieloberfläche (HTML+CSS+JS)
│   │   └── client.html    # Alternative Client-Seite
│   └── node_modules/      # npm Pakete
├── Dockerfile             # Docker-Image für Container-Hosting
├── start.sh              # Bash-Startskript
├── .replit               # Replit-Konfiguration
└── README.md             # Diese Datei
```

---

## 🔧 Technologie-Stack

| Komponente | Technologie |
|-----------|-------------|
| Backend | Node.js + Express.js |
| Echtzeit-Kommunikation | WebSocket (ws Bibliothek) |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| Deployment | Docker, Replit, Railway, etc. |

### Abhängigkeiten
- `express` — Web-Framework
- `ws` — WebSocket-Bibliothek
- `crypto` — Eindeutige Spieler-IDs

---

## 👥 Spielen im Klassenzimmer

### Vorbereitung (für Lehrkräfte)
1. **Online-Link kopieren** (siehe oben) oder lokal starten
2. **QR-Code/URL an Tafel** oder per Mail teilen
3. **Mindestens 6 Schüler** sollten beitreten

### Ablauf
1. **Host (du als Lehrer):** Browser öffnen, „Lobby erstellen"
2. **Code kopieren** (z.B. `ABC123`) und an die Tafel schreiben
3. **Schüler:** Ihre Geräte/Laptops öffnen, URL eingeben, Namen + Code eingeben
4. **Nach 6 Spielern:** Host klickt „Spiel starten"
5. **Spiel läuft:** Schüler diskutieren IRL, melden Leichen über App, stimmen ab

### Tipps
- **Erste Runde:** Regeln erklären, langsam spielen
- **Mehrere Runden:** Spieler lernen schnell Strategien
- **Detektiv-Hinweis:** Detektiv das Chatfenster zeigen (nur ihm sichtbar)
- **Seherin-Power:** Seherin darf nur einmal checken — sorgfältig wählen!

---

## 🐛 Häufig gestellte Fragen

### F: Kann ich das Spiel auch offline spielen?
**A:** Nein, es braucht einen Server. Lokal kannst du `npm start` auf einem Laptop starten und andere über IP beitreten lassen.

### F: Was passiert, wenn der Host die Verbindung abbricht?
**A:** Ein anderer Spieler wird automatisch neuer Host. Spiel läuft weiter.

### F: Kann ich Rollen/Anzahl anpassen?
**A:** Ja! Server-Code (`project/server.js`) editieren — `room.imposters` Wert ändern oder Role-Zuweisungslogik anpassen.

### F: Funktioniert es auf Tablets/Smartphones?
**A:** Ja, responsive Design. Kleinere Bildschirme möglich, aber PC/Laptop empfohlen.

### F: Warum "Impostor" und nicht "Imposter"?
**A:** Englische Schreibweise aus "Among Us" — bewusst beibehalten. 😊

---

## 📝 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert. Kostenlos für Bildung und privaten Gebrauch.

---

## 🤝 Beitragen

Ideen oder Bugs? Willkommen!
- GitHub Issues eröffnen
- Pull Requests senden
- Vorschläge im Code kommentieren

---

## 👨‍💻 Entwickler

Entwickelt für Schulen und Klassenzimmer. Leicht anzupassen und zu erweitern.

**Kontakt/Support:** GitHub Issues oder Email

---

**Viel Spaß beim Spielen! 🎮**
