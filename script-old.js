
const API_URL = "https://tu-api-url.com"; // Reemplazar por URL real

// Simula comentarios para prueba
const comentarios = [
    { nickname: "ShadowWolf", texto: "Buen stream como siempre!" },
    { nickname: "LunaGamer", texto: "Team mamá 100%" },
    { nickname: "CoderDude", texto: "Voten por mí 😁" }
];

let votoActual = null;

function renderComentarios() {
    const container = document.getElementById("comentarios-list");
    container.innerHTML = "";
    comentarios.forEach((c, index) => {
        const div = document.createElement("div");
        div.classList.add("comentario");
        div.innerHTML = `
      <p><strong>${c.nickname}</strong></p>
      <p>${c.texto}</p>
      <button class="votar-btn" onclick="votar(${index}, this)">Votar</button>
    `;
        container.appendChild(div);
    });
}

function votar(index, boton) {
    const botones = document.querySelectorAll(".votar-btn");
    botones.forEach(b => b.classList.remove("selected"));
    if (votoActual === index) {
        votoActual = null;
    } else {
        votoActual = index;
        boton.classList.add("selected");
    }
    // Aquí se puede enviar el voto al backend si se desea
}

function cargarPozo() {
    fetch(`${API_URL}/api/game/pozo-actual`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("pozo").innerText = `S/ ${data.amount}`;
        })
        .catch(() => {
            document.getElementById("pozo").innerText = "Error al cargar";
        });
}

// Init
renderComentarios();
cargarPozo();
