// ========= CONFIG =========
const API_URL = "https://humble-space-rotary-phone-69gprj5g4w76fxrgj-5003.app.github.dev";           // <-- reemplaza
const HUB_URL = "https://humble-space-rotary-phone-69gprj5g4w76fxrgj-5003.app.github.dev/hub/realtime"; // <-- reemplaza (https obligatorio)
const POLL_INTERVAL_MS = 15000; // fallback si SignalR falla

// ========= STATE =========
let gameId = null;
let gameType = null;
let comments = []; // [{ id, nickname, comment, votes, canVote, hasVoted }]
let rouletteParticipants = []; // [{ id, nickname }]
let currentVotedId = null; // para resaltar el voto actual en UI

// ========= HELPERS =========
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function setPot(amount) {
    const el = qs("#pozo");
    if (!el) return;
    const num = Number(amount);
    el.textContent = `S/ ${Number.isFinite(num) ? num.toFixed(2) : "0.00"}`;
}

function setVideo(html) {
    const container = qs("#tiktok-embed");
    if (!container) return;
    container.innerHTML = html || "<p>Sin video configurado.</p>";
    // Si el HTML de TikTok necesita su script:
    if (html?.includes("tiktok-embed")) {
        const sc = document.createElement("script");
        sc.async = true;
        sc.src = "https://www.tiktok.com/embed.js";
        container.appendChild(sc);
    }
}

function sortCommentsDesc() {
    comments.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
}

function renderComments() {
    sortCommentsDesc();
    const container = qs("#comentarios-list");
    if (!container) return;
    container.innerHTML = "";

    const votingEnabled = comments.some(c => c.canVote);
    if (!votingEnabled) {
        const notice = document.createElement("p");
        notice.className = "voting-closed";
        notice.textContent = "Voting closed";
        container.appendChild(notice);
    }

    comments.forEach(c => {
        const div = document.createElement("div");
        div.className = "comentario";

        // Estado del botón
        const disabled = !c.canVote;
        const youVotedThis = c.hasVoted || c.id === currentVotedId;

        const commentText = c.commentPending
            ? "(Comentario pendiente)"
            : escapeHtml(c.comment ?? "");

        div.innerHTML = `
      <p><strong>${escapeHtml(c.nickname ?? "Anon")}</strong></p>
      <p>${commentText}</p>
      <div class="comment-footer">
        <span class="votes-tag">🗳️ ${c.votes ?? 0}</span>
        <button
          class="votar-btn ${youVotedThis ? "selected" : ""}"
          ${disabled ? "disabled" : ""}
          data-id="${c.id}"
          title="${disabled ? "Votación deshabilitada" : (youVotedThis ? "Tu voto" : "Votar")}" 
        >
          ${youVotedThis ? "Votaste" : "Votar"}
        </button>
      </div>
    `;
        container.appendChild(div);
    });

    // Bind votes
    qsa(".votar-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            await sendVote(id);
        });
    });
}

function renderRoulette() {
    const commentSection = qs(".comentarios");
    if (commentSection) commentSection.style.display = "none";
    const videoSection = qs(".tiktok-container");
    if (videoSection) videoSection.style.display = "none";

    const section = qs("#roulette-section");
    if (!section) return;
    section.style.display = "block";

    drawRouletteWheel();
}

function drawRouletteWheel() {
    const canvas = qs("#roulette-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) / 2;
    const n = rouletteParticipants.length;

    if (n === 0) {
        ctx.beginPath();
        ctx.fillStyle = "#ff66cc33";
        ctx.arc(width / 2, height / 2, radius - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius - 5, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        return;
    }

    const angle = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
        const start = angle * i - Math.PI / 2;
        const end = start + angle;
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.arc(width / 2, height / 2, radius - 5, start, end);
        ctx.closePath();
        ctx.fillStyle = `hsl(${(i * 360) / n}, 85%, 55%)`;
        ctx.fill();
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(start + angle / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "16px 'Poppins', sans-serif";
        const text = rouletteParticipants[i].nickname;
        ctx.fillText(text, radius - 10, 0);
        ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius - 5, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
}

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ========= API CALLS =========
async function loadInitial() {
    const res = await fetch(`${API_URL}/game`, { credentials: "include" });
    if (!res.ok) throw new Error("GET /game failed");
    const data = await res.json();

    gameId = data.id ?? null;
    gameType = data.type;
    setPot(data.prizePoolAmount);

    switch (gameType) {
        case "Roulette":
            rouletteParticipants = (data.participants || []).map(p => ({
                id: p.id,
                nickname: p.nickname
            }));
            renderRoulette();
            break;
        case "Comments":
        default:
            setVideo(data.videoHtml);
            comments = (data.participants || []).map(p => ({
                id: p.id,
                nickname: p.nickname,
                comment: p.comment,
                commentPending: !!p.commentPending,
                votes: p.votes ?? 0,
                canVote: !!p.canVote,
                hasVoted: !!p.hasVoted
            }));
            const voted = comments.find(c => c.hasVoted);
            currentVotedId = voted ? voted.id : null;
            renderComments();
            break;
    }
}

async function sendVote(participantId) {
    try {
        const res = await fetch(`${API_URL}/vote/${participantId}`, {
            method: "POST",
            credentials: "include"
        });
        if (!res.ok) {
            const t = await res.text();
            console.warn("Vote rejected:", t);
            // opcional: mostrar toast
            return;
        }
        const { participantId: id, totalVotes } = await res.json();

        // Actualiza estado local (inmediato) para buena UX
        comments = comments.map(c => {
            if (c.id === id) {
                return { ...c, votes: totalVotes, hasVoted: true };
            } else {
                // Como solo 1 voto por IP, marcar los demás como no votados
                return { ...c, hasVoted: false };
            }
        });
        currentVotedId = id;
        renderComments();
    } catch (e) {
        console.error("sendVote error:", e);
    }
}

// ========= SIGNALR =========
// Necesitas añadir en index.html:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js"></script>
let connection = null;

async function connectSignalR() {
    if (!window.signalR) {
        console.warn("SignalR script not found. Skipping realtime.");
        return;
    }

    connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { withCredentials: true })
        .withAutomaticReconnect()
        .build();

    // Eventos que envía el backend:
    connection.on("PotUpdated", ({ prizePoolAmount }) => {
        setPot(prizePoolAmount);
    });

    connection.on("RouletteWinner", (w) => {
        const result = qs("#roulette-result");
        if (result) result.textContent = `Ganador: ${escapeHtml(w.nickname || w.id)}`;
    });

    connection.on("CommentAdded", (c) => {
        // Esperamos un objeto { id, nickname, comment, votes?, canVote?, hasVoted? }
        const idx = comments.findIndex(x => x.id === c.id);
        if (idx === -1) {
            comments.push({
                id: c.id,
                nickname: c.nickname,
                comment: c.comment,
                commentPending: !!c.commentPending,
                votes: c.votes ?? 0,
                canVote: c.canVote ?? true,
                hasVoted: false
            });
        } else {
            comments[idx] = {
                ...comments[idx],
                comment: c.comment,
                commentPending: !!c.commentPending,
            };
        }
        renderComments();
    });

    connection.on("NicknameRegistered", (c) => {
        const exists = comments.some(x => x.id === c.id);
        if (!exists) {
            comments.push({
                id: c.id,
                nickname: c.nickname,
                comment: c.comment,
                commentPending: !!c.commentPending,
                votes: c.votes ?? 0,
                canVote: c.canVote ?? true,
                hasVoted: false
            });
            renderComments();
        }
    });

    connection.on("VoteUpdated", (id, totalVotes) => {
        // Nota: si enviaste un objeto { participantId, totalVotes } cambia la firma
        comments = comments.map(c => c.id === id ? { ...c, votes: totalVotes } : c);
        renderComments();
    });

    connection.on("VideoUpdated", ({ html }) => {
        setVideo(html);
    });

    try {
        await connection.start();
        console.log("✅ SignalR conectado");
        // Si usas grupos por juego:
        // if (gameId) await connection.invoke("JoinGame", String(gameId));
    } catch (err) {
        console.error("SignalR start error:", err);
        // fallback: polling
        startPollingFallback();
    }

    connection.onreconnected(() => console.log("🔄 SignalR reconnected"));
    connection.onclose(() => {
        console.warn("SignalR closed. Starting polling fallback.");
        startPollingFallback();
    });
}

// ========= POLLING FALLBACK =========
let pollingTimer = null;

function startPollingFallback() {
    if (pollingTimer) return;
    pollingTimer = setInterval(async () => {
        try {
            await loadInitial(); // recarga estado
        } catch (e) {
            console.warn("Polling failed:", e.message);
        }
    }, POLL_INTERVAL_MS);
}

// ========= BOOT =========
(async function init() {
    try {
        await loadInitial();
        await connectSignalR();
    } catch (e) {
        console.error("Init failed:", e);
        // si falla todo, al menos intenta polling
        startPollingFallback();
    }
})();
