# Imposter Online — Fertiges Projekt mit Lobbys, Rollen & Powers

Dieses Dokument enthält **zwei Dateien** zum Herunterladen / Kopieren:

1. **server.js** — Node.js WebSocket + Express Server (verwaltet Lobbys, Rollen, Votes, Powers)
2. **public/client.html** — Client-Webseite, die alle Spieler auf ihren Geräten öffnen

---

## Hinweise kurz
- Lobby-System: Erstelle Raum (6-stelliger Code) oder trete einem Raum bei.
- Rollen: 4 × Imposter, 1 × Detektiv (Hinweise), 1 × Seherin (einmal Rolle aufdecken). Rest Crew.
- Seherin: 1× Fähigkeit, Server gibt die Rolle des angeklickten Spielers zurück (nur für Seherin sichtbar).
- Detektiv: Nachdem eine Leiche gemeldet wird, erhält der Detektiv **einen Hinweis** — eine kleine Kandidatenliste (z. B. 3 Namen), in der mindestens einer ein Imposter ist (wenn möglich). Keine genauen Enthüllungen.
- Voting & Powers laufen über die App. Ihr spielt IRL (bewegung, Diskussion, Report via App).

---

## server.js

```js
// server.js
// Node.js + Express + ws
// Starten: npm init -y && npm i express ws && node server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const app = express();
app.use(express.static(__dirname + '/public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Rooms: code -> { players: {uid->player}, hostUid, started, imposters }
const rooms = {};

function makeCode() {
  return Math.random().toString(36).substring(2,8).toUpperCase(); // 6 chars
}

function send(ws, obj){ if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function broadcastRoom(room, obj){ Object.values(room.players).forEach(p=>send(p.ws,obj)); }

wss.on('connection', ws => {
  ws.uid = crypto.randomBytes(8).toString('hex');
  ws.roomCode = null;

  send(ws, { type: 'connected', uid: ws.uid });

  ws.on('message', message => {
    let data;
    try { data = JSON.parse(message); } catch(e){ return; }

    // CREATE LOBBY
    if(data.type === 'createLobby'){
      let code = makeCode(); while(rooms[code]) code = makeCode();
      rooms[code] = { code, hostUid: ws.uid, players: {}, started:false, imposters:4 };
      ws.roomCode = code;
      rooms[code].players[ws.uid] = { uid: ws.uid, name: data.name||'Host', ws, alive:true, role:null, seerUsed:false };
      send(ws, { type:'lobbyCreated', code });
      send(ws, { type:'lobbyUpdate', room: summarizeRoom(code) });
      return;
    }

    // JOIN LOBBY
    if(data.type === 'joinLobby'){
      const code = (data.code||'').toUpperCase();
      const room = rooms[code];
      if(!room){ send(ws, { type:'error', message:'Lobby existiert nicht.'}); return; }
      if(room.started){ send(ws, { type:'error', message:'Spiel bereits gestartet.'}); return; }
      ws.roomCode = code;
      room.players[ws.uid] = { uid: ws.uid, name: data.name||'Spieler', ws, alive:true, role:null, seerUsed:false };
      // send update
      broadcastRoom(room, { type:'lobbyUpdate', room: summarizeRoom(code) });
      return;
    }

    // SET NAME
    if(data.type === 'setName'){
      const room = rooms[ws.roomCode]; if(!room) return;
      const p = room.players[ws.uid]; if(!p) return;
      p.name = data.name;
      broadcastRoom(room, { type:'lobbyUpdate', room: summarizeRoom(ws.roomCode) });
      return;
    }

    // START GAME (only host)
    if(data.type === 'startGame'){
      const room = rooms[ws.roomCode]; if(!room) return;
      if(room.hostUid !== ws.uid) { send(ws,{type:'error',message:'Nur Host darf starten.'}); return; }
      // set default imposters to 4 but ensure not more imposters than players-2
      const playersArr = Object.keys(room.players);
      const n = playersArr.length;
      if(n < 6){ send(ws,{type:'error',message:'Mindestens 6 Spieler für dieses Setup nötig.'}); return; }

      room.started = true;
      room.imposters = 4;

      // assign roles randomly
      const ids = playersArr.slice();
      // shuffle
      for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }

      // assign imposters
      for(let i=0;i<room.imposters;i++){ room.players[ids[i]].role = 'Imposter'; }
      // assign detective
      if(ids.length > room.imposters) room.players[ids[room.imposters]].role = 'Detektiv';
      // assign seer
      if(ids.length > room.imposters+1) room.players[ids[room.imposters+1]].role = 'Seherin';
      // rest crew
      ids.forEach(id => { if(!room.players[id].role) room.players[id].role = 'Crew'; });

      // notify each player privately about role
      Object.values(room.players).forEach(p=>{ send(p.ws, { type:'roleAssigned', role: p.role }); });

      // broadcast started + public players list (without roles)
      broadcastRoom(room, { type:'gameStarted', room: summarizeRoom(ws.roomCode) });
      return;
    }

    // KILL (Imposter action) - server trusts client that only Imposters request this
    if(data.type === 'kill'){
      const room = rooms[ws.roomCode]; if(!room) return;
      const target = room.players[data.target]; if(!target) return;
      target.alive = false;
      broadcastRoom(room, { type:'playerKilled', target: data.target, players: summarizePlayers(room) });
      return;
    }

    // REPORT (anyone)
    if(data.type === 'report'){
      const room = rooms[ws.roomCode]; if(!room) return;
      // broadcast report to all -> opens voting in clients
      broadcastRoom(room, { type:'reportCalled', reporter: ws.uid, players: summarizePlayers(room) });
      // send detective hint privately if detective alive
      const det = Object.values(room.players).find(p=>p.role==='Detektiv' && p.alive);
      if(det){
        const hint = makeDetectiveHint(room);
        send(det.ws, { type:'detectiveHint', hint });
      }
      return;
    }

    // SEER USE (only Seherin alive & unused)
    if(data.type === 'seerCheck'){
      const room = rooms[ws.roomCode]; if(!room) return;
      const me = room.players[ws.uid]; if(!me || me.role !== 'Seherin' || !me.alive){ send(ws,{type:'error',message:'Nicht berechtigt.'}); return; }
      if(me.seerUsed){ send(ws,{type:'error',message:'Fähigkeit bereits verwendet.'}); return; }
      const target = room.players[data.target]; if(!target){ send(ws,{type:'error',message:'Ziel nicht gefunden.'}); return; }
      me.seerUsed = true;
      // reveal role to seer only
      send(ws, { type:'seerResult', target: data.target, role: target.role });
      return;
    }

    // VOTE
    if(data.type === 'vote'){
      const room = rooms[ws.roomCode]; if(!room) return;
      // store votes on room.votes: voterUid->targetUid
      if(!room.votes) room.votes = {};
      room.votes[ws.uid] = data.target; // can be null for skip
      broadcastRoom(room, { type:'voteUpdate', votesCount: Object.keys(room.votes).length, total: Object.keys(room.players).filter(p=>room.players[p].alive).length });
      return;
    }

    // FINISH VOTE (host triggers tally)
    if(data.type === 'finishVote'){
      const room = rooms[ws.roomCode]; if(!room) return;
      if(room.hostUid !== ws.uid){ send(ws,{type:'error',message:'Nur Host darf abst. beenden.'}); return; }
      const counts = {};
      if(room.votes){ Object.values(room.votes).forEach(t=>{ if(t===null) return; counts[t]= (counts[t]||0)+1; }); }
      // find max
      let max = 0; let chosen = null; let tie = false;
      for(const k in counts){ if(counts[k] > max){ max = counts[k]; chosen = k; tie=false; } else if(counts[k] === max){ tie=true; } }
      if(!chosen || tie){ broadcastRoom(room, { type:'voteResult', executed: null, reason: 'tie' }); }
      else { room.players[chosen].alive = false; broadcastRoom(room, { type:'voteResult', executed: chosen, players: summarizePlayers(room) }); }
      // clear votes
      room.votes = {};
      return;
    }

    // LEAVE
    if(data.type === 'leave'){ const room = rooms[ws.roomCode]; if(room){ delete room.players[ws.uid]; broadcastRoom(room,{type:'lobbyUpdate',room:summarizeRoom(ws.roomCode)}); } ws.roomCode=null; }

  }); // on message

  ws.on('close', ()=>{
    const code = ws.roomCode; if(!code) return;
    const room = rooms[code]; if(!room) return;
    delete room.players[ws.uid];
    // if empty delete room
    if(Object.keys(room.players).length===0){ delete rooms[code]; return; }
    // if host left, pick new host
    if(room.hostUid === ws.uid){ room.hostUid = Object.keys(room.players)[0]; }
    broadcastRoom(room, { type:'lobbyUpdate', room: summarizeRoom(code) });
  });
});

function summarizeRoom(code){ const room = rooms[code]; if(!room) return null; return { code: room.code, hostUid: room.hostUid, started: room.started, players: summarizePlayers(room) }; }
function summarizePlayers(room){ return Object.values(room.players).map(p=>({ uid: p.uid, name: p.name, alive: p.alive })); }

function makeDetectiveHint(room){ // choose k candidates (3) trying to include at least one imposter
  const players = Object.values(room.players).filter(p=>p.alive);
  const imposters = players.filter(p=>p.role==='Imposter');
  const crew = players.filter(p=>p.role!=='Imposter');
  const candidates = [];
  // ensure at least one imposter in hint if exists
  if(imposters.length>0){ candidates.push(imposters[Math.floor(Math.random()*imposters.length)].uid); }
  // fill up to 3
  const pool = players.map(p=>p.uid).filter(u=>!candidates.includes(u));
  while(candidates.length < 3 && pool.length>0){ const i = Math.floor(Math.random()*pool.length); candidates.push(pool.splice(i,1)[0]); }
  // convert to names
  return candidates.map(uid => ({ uid, name: room.players[uid].name }));
}

// start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, ()=> console.log('Server läuft auf Port', PORT));
```

---

## public/client.html

Die client.html ist eine einseitige App (HTML+JS) die Lobbys erstellt, beitritt, Rollen anzeigt, Seherin- & Detectiv-Aktionen erlaubt, Abstimmungen verwaltet.

> **Wichtig:** Die client.html unten in `/public` speichern. Der Server (server.js) dient sie statisch.

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Imposter — Online</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#0b1220;color:#e6eef8;padding:18px}
.card{background:#0f1724;padding:12px;border-radius:8px;margin-bottom:10px}
button,input{padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit}
.player{padding:8px;background:#071022;margin:6px 0;border-radius:6px}
.small{font-size:13px;color:#9aa6bf}
</style>
</head>
<body>
<h2>Imposter — Online (Lobby & Rollen)</h2>
<div class="card" id="welcome">
  Name: <input id="nameInput" placeholder="Dein Name" />
  <button id="createBtn">Lobby erstellen</button>
  <br/><br/>
  Raumcode beitreten: <input id="joinCode" placeholder="AAAAAA" style="width:120px" />
  <button id="joinBtn">Beitreten</button>
  <div id="lobbyActions" style="margin-top:8px"></div>
</div>

<div class="card" id="lobby" style="display:none">
  <div><strong>Raum:</strong> <span id="roomCode"></span> <span class="small">(Host: <span id="hostName"></span>)</span></div>
  <div style="margin-top:8px"><strong>Spieler</strong></div>
  <div id="playersList"></div>
  <div style="margin-top:8px" id="hostControls" style="display:none">
    Imposter: <input id="imposterCount" type="number" value="4" min="1" max="6" />
    <button id="startGameBtn">Spiel starten</button>
  </div>
</div>

<div class="card" id="game" style="display:none">
  <div><strong>Deine Rolle:</strong> <span id="myRole"></span></div>
  <div class="small" id="roleNote"></div>
  <div style="margin-top:8px"><strong>Aktionen</strong></div>
  <div id="actions"></div>
  <div style="margin-top:10px"><button id="reportBtn">Leiche melden (Report)</button></div>
  <div style="margin-top:10px"><strong>Spielerstatus</strong><div id="statusPlayers"></div></div>
  <div style="margin-top:8px"><strong>Abstimmung</strong><div id="voteArea"></div></div>
  <div style="margin-top:8px"><div id="log"></div></div>
</div>

<script>
let ws = null; let myUid=null; let room=null; let myRole=null; let seerUsed=false;
function log(msg){ const el=document.getElementById('log'); el.innerHTML = `<div class="small">${new Date().toLocaleTimeString()} — ${msg}</div>` + el.innerHTML; }

function connect(){ ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host );
  ws.onopen = ()=>{ console.log('connected'); }
  ws.onmessage = e => { const d = JSON.parse(e.data); handle(d); }
}
connect();

function handle(d){
  if(d.type === 'connected'){ myUid = d.uid; }
  if(d.type === 'lobbyCreated'){ document.getElementById('lobby').style.display='block'; document.getElementById('welcome').style.display='none'; }
  if(d.type === 'lobbyUpdate'){ room = d.room; renderLobby(); }
  if(d.type === 'gameStarted'){ room = d.room; document.getElementById('lobby').style.display='none'; document.getElementById('game').style.display='block'; renderPlayers(room.players); }
  if(d.type === 'roleAssigned'){ myRole = d.role; document.getElementById('myRole').innerText = myRole; if(myRole==='Detektiv') document.getElementById('roleNote').innerText='Du bist Detektiv — du erhältst Hinweise, aber keine direkten Namen.'; if(myRole==='Seherin') document.getElementById('roleNote').innerText='Du bist Seherin — du kannst EINMAL die Rolle einer Person aufdecken.'; }
  if(d.type === 'playerKilled'){ renderPlayers(d.players); log('Ein Spieler wurde getötet.'); }
  if(d.type === 'reportCalled'){ openVoting(); log('Report: Abstimmung gestartet'); }
  if(d.type === 'detectiveHint'){ alert('DETEKTIV-HINWEIS:
' + d.hint.map(h=>h.name).join('
')); }
  if(d.type === 'seerResult'){ alert('Seherin: ' + d.role); seerUsed=true; renderActions(); }
  if(d.type === 'voteUpdate'){ document.getElementById('voteArea').innerText = 'Abstimmungs-Stimmen: ' + d.votesCount + ' / ' + d.total; }
  if(d.type === 'voteResult'){ if(d.executed){ alert('Ausgeführt: ' + d.executed); renderPlayers(d.players); } else { alert('Abstimmung ungültig oder unentschieden.'); } }
  if(d.type === 'lobbyUpdate'){ room = d.room; renderLobby(); }
}

// UI handlers
document.getElementById('createBtn').onclick = ()=>{
  const name = document.getElementById('nameInput').value || 'Host';
  ws.send(JSON.stringify({ type:'createLobby', name }));
};

document.getElementById('joinBtn').onclick = ()=>{
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  const name = document.getElementById('nameInput').value || 'Spieler';
  ws.send(JSON.stringify({ type:'joinLobby', code, name }));
  document.getElementById('lobby').style.display='block'; document.getElementById('welcome').style.display='none';
};

function renderLobby(){ if(!room) return; document.getElementById('roomCode').innerText = room.code; document.getElementById('hostName').innerText = room.hostUid; const list = document.getElementById('playersList'); list.innerHTML=''; room.players.forEach(p=>{ const d=document.createElement('div'); d.className='player'; d.innerText = p.name; list.appendChild(d); });
  // host controls
  if(room.hostUid === myUid){ document.getElementById('hostControls').style.display='block'; } else document.getElementById('hostControls').style.display='none'; }

document.getElementById('startGameBtn').onclick = ()=>{ ws.send(JSON.stringify({ type:'startGame' })); }

function renderPlayers(players){ const el = document.getElementById('statusPlayers'); el.innerHTML=''; players.forEach(p=>{ const d = document.createElement('div'); d.className='player'; d.innerText = p.name + ' — ' + (p.alive?'Lebt':'Tot'); d.dataset.uid = p.uid; d.onclick = ()=>{ if(myRole==='Seherin' && !seerUsed && p.uid !== myUid){ if(confirm('Seherin: Rolle von '+p.name+' überprüfen?')){ ws.send(JSON.stringify({ type:'seerCheck', target: p.uid })); } } else if(myRole==='Imposter' && p.alive && p.uid!==myUid){ if(confirm('Imposter: Töte '+p.name+'?')) ws.send(JSON.stringify({ type:'kill', target: p.uid })); } else { /* no-op */ } }; el.appendChild(d); }); renderActions(); }

function renderActions(){ const a = document.getElementById('actions'); a.innerHTML=''; if(myRole==='Seherin'){ const btn = document.createElement('div'); btn.innerText = seerUsed? 'Seherin (verbraucht)':'Seherin: Tippe auf einen Spieler in der Liste, um Rolle aufzudecken.'; a.appendChild(btn); }
  if(myRole==='Imposter'){ const note = document.createElement('div'); note.innerText='Imposter: Tippe auf Spieler zum Töten.'; a.appendChild(note); }
  if(myRole==='Detektiv'){ const note = document.createElement('div'); note.innerText='Detektiv: Du bekommst Hinweise nachdem ein Report gemacht wird.'; a.appendChild(note); }
}

document.getElementById('reportBtn').onclick = ()=>{ if(confirm('Leiche melden? (Reporter drücken)')) ws.send(JSON.stringify({ type:'report' })); }

function openVoting(){ // simple vote UI
  const area = document.getElementById('voteArea'); area.innerHTML=''; room.players.forEach(p=>{ if(p.alive){ const b = document.createElement('button'); b.innerText = 'Stimme für ' + p.name; b.onclick = ()=>{ ws.send(JSON.stringify({ type:'vote', target: p.uid })); log('Du stimmst für ' + p.name); }; area.appendChild(b); } }); if(room.hostUid===myUid){ const finish = document.createElement('button'); finish.innerText='Abstimmung beenden'; finish.onclick= ()=>{ ws.send(JSON.stringify({ type:'finishVote' })); }; area.appendChild(finish); } }

</script>
</body>
</html>
```

---

## Deployment & Anleitung zum Start (kurz)
1. Lege Ordner `imposter-online` an.
2. Speichere `server.js` (oben) in diesem Ordner.
3. Erstelle Unterordner `public` und speichere die `client.html` dort.
4. Terminal: `npm init -y && npm i express ws`
5. `node server.js`
6. Schüler öffnen im Browser: `http://SERVER_IP:8080` (z. B. `http://192.168.0.12:8080`)

📌 **Firewall/Netz**: Stelle sicher, dass Port 8080 im Klassen-Netzwerk erreichbar ist.

---

## Hinweise & Grenzen
- Der Server vertraut Clients bei bestimmten Aktionen (z. B. Kill), weil IRL Ehrlichkeit vorausgesetzt wird. Für mehr Sicherheit müssten Kills serverseitig mit Rollenprüfung durchgeführt werden (das ist möglich — ich kann das nachziehen).
- Wenn ihr wollt, kann ich noch ein: Lobby-Code-System mit Passwort, Spiel-Logs exportieren, Timer pro Runde, Authentifizierung und bessere UI hinzufügen.

---

Wenn du möchtest, aktualisiere ich jetzt noch:
- Timer pro Phase (Diskussion, Abstimmung)
- Export der Spielhistorie
- Server-seitige Berechtigungskontrolle für Kills (damit nur Imposter killen können)

Sag einfach, welche Extras du möchtest — ich baue sie direkt ein.
