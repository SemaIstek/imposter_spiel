// server.js
// Node.js + Express + ws
// Start: `npm install` then `npm start`

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const app = express();
app.use(express.static(__dirname + '/public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

function makeCode() {
	return Math.random().toString(36).substring(2,8).toUpperCase();
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

		if(data.type === 'createLobby'){
			let code = makeCode(); while(rooms[code]) code = makeCode();
			rooms[code] = { code, hostUid: ws.uid, players: {}, started:false, imposters:4 };
			ws.roomCode = code;
			rooms[code].players[ws.uid] = { uid: ws.uid, name: data.name||'Host', ws, alive:true, role:null, seerUsed:false };
			send(ws, { type:'lobbyCreated', code });
			send(ws, { type:'lobbyUpdate', room: summarizeRoom(code) });
			return;
		}

		if(data.type === 'joinLobby'){
			const code = (data.code||'').toUpperCase();
			const room = rooms[code];
			if(!room){ send(ws, { type:'error', message:'Lobby existiert nicht.'}); return; }
			if(room.started){ send(ws, { type:'error', message:'Spiel bereits gestartet.'}); return; }
			ws.roomCode = code;
			room.players[ws.uid] = { uid: ws.uid, name: data.name||'Spieler', ws, alive:true, role:null, seerUsed:false };
			broadcastRoom(room, { type:'lobbyUpdate', room: summarizeRoom(code) });
			return;
		}

		if(data.type === 'setName'){
			const room = rooms[ws.roomCode]; if(!room) return;
			const p = room.players[ws.uid]; if(!p) return;
			p.name = data.name;
			broadcastRoom(room, { type:'lobbyUpdate', room: summarizeRoom(ws.roomCode) });
			return;
		}

		if(data.type === 'startGame'){
			const room = rooms[ws.roomCode]; if(!room) return;
			if(room.hostUid !== ws.uid) { send(ws,{type:'error',message:'Nur Host darf starten.'}); return; }
			const playersArr = Object.keys(room.players);
			const n = playersArr.length;
			if(n < 6){ send(ws,{type:'error',message:'Mindestens 6 Spieler für dieses Setup nötig.'}); return; }
			room.started = true;
			room.imposters = 4;
			const ids = playersArr.slice();
			for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
			for(let i=0;i<room.imposters;i++){ room.players[ids[i]].role = 'Imposter'; }
			if(ids.length > room.imposters) room.players[ids[room.imposters]].role = 'Detektiv';
			if(ids.length > room.imposters+1) room.players[ids[room.imposters+1]].role = 'Seherin';
			ids.forEach(id => { if(!room.players[id].role) room.players[id].role = 'Crew'; });
			Object.values(room.players).forEach(p=>{ send(p.ws, { type:'roleAssigned', role: p.role }); });
			broadcastRoom(room, { type:'gameStarted', room: summarizeRoom(ws.roomCode) });
			return;
		}

		if(data.type === 'kill'){
			const room = rooms[ws.roomCode]; if(!room) return;
			const target = room.players[data.target]; if(!target) return;
			target.alive = false;
			broadcastRoom(room, { type:'playerKilled', target: data.target, players: summarizePlayers(room) });
			return;
		}

		if(data.type === 'report'){
			const room = rooms[ws.roomCode]; if(!room) return;
			broadcastRoom(room, { type:'reportCalled', reporter: ws.uid, players: summarizePlayers(room) });
			const det = Object.values(room.players).find(p=>p.role==='Detektiv' && p.alive);
			if(det){
				const hint = makeDetectiveHint(room);
				send(det.ws, { type:'detectiveHint', hint });
			}
			return;
		}

		if(data.type === 'seerCheck'){
			const room = rooms[ws.roomCode]; if(!room) return;
			const me = room.players[ws.uid]; if(!me || me.role !== 'Seherin' || !me.alive){ send(ws,{type:'error',message:'Nicht berechtigt.'}); return; }
			if(me.seerUsed){ send(ws,{type:'error',message:'Fähigkeit bereits verwendet.'}); return; }
			const target = room.players[data.target]; if(!target){ send(ws,{type:'error',message:'Ziel nicht gefunden.'}); return; }
			me.seerUsed = true;
			send(ws, { type:'seerResult', target: data.target, role: target.role });
			return;
		}

		if(data.type === 'vote'){
			const room = rooms[ws.roomCode]; if(!room) return;
			if(!room.votes) room.votes = {};
			room.votes[ws.uid] = data.target;
			broadcastRoom(room, { type:'voteUpdate', votesCount: Object.keys(room.votes).length, total: Object.keys(room.players).filter(p=>room.players[p].alive).length });
			return;
		}

		if(data.type === 'finishVote'){
			const room = rooms[ws.roomCode]; if(!room) return;
			if(room.hostUid !== ws.uid){ send(ws,{type:'error',message:'Nur Host darf abst. beenden.'}); return; }
			const counts = {};
			if(room.votes){ Object.values(room.votes).forEach(t=>{ if(t===null) return; counts[t]= (counts[t]||0)+1; }); }
			let max = 0; let chosen = null; let tie = false;
			for(const k in counts){ if(counts[k] > max){ max = counts[k]; chosen = k; tie=false; } else if(counts[k] === max){ tie=true; } }
			if(!chosen || tie){ broadcastRoom(room, { type:'voteResult', executed: null, reason: 'tie' }); }
			else { room.players[chosen].alive = false; broadcastRoom(room, { type:'voteResult', executed: chosen, players: summarizePlayers(room) }); }
			room.votes = {};
			return;
		}

		if(data.type === 'leave'){ const room = rooms[ws.roomCode]; if(room){ delete room.players[ws.uid]; broadcastRoom(room,{type:'lobbyUpdate',room:summarizeRoom(ws.roomCode)}); } ws.roomCode=null; }

	});

	ws.on('close', ()=>{
		const code = ws.roomCode; if(!code) return;
		const room = rooms[code]; if(!room) return;
		delete room.players[ws.uid];
		if(Object.keys(room.players).length===0){ delete rooms[code]; return; }
		if(room.hostUid === ws.uid){ room.hostUid = Object.keys(room.players)[0]; }
		broadcastRoom(room, { type:'lobbyUpdate', room: summarizeRoom(code) });
	});

});

function summarizeRoom(code){ const room = rooms[code]; if(!room) return null; return { code: room.code, hostUid: room.hostUid, started: room.started, players: summarizePlayers(room) }; }
function summarizePlayers(room){ return Object.values(room.players).map(p=>({ uid: p.uid, name: p.name, alive: p.alive })); }

function makeDetectiveHint(room){
	const players = Object.values(room.players).filter(p=>p.alive);
	const imposters = players.filter(p=>p.role==='Imposter');
	const candidates = [];
	if(imposters.length>0){ candidates.push(imposters[Math.floor(Math.random()*imposters.length)].uid); }
	const pool = players.map(p=>p.uid).filter(u=>!candidates.includes(u));
	while(candidates.length < 3 && pool.length>0){ const i = Math.floor(Math.random()*pool.length); candidates.push(pool.splice(i,1)[0]); }
	return candidates.map(uid => ({ uid, name: room.players[uid].name }));
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, ()=> console.log('Server läuft auf Port', PORT));
