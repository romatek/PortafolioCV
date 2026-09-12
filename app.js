// --- BASE DE DATOS Y ESTADOS ---
let db;
const request = indexedDB.open("LocalPortfolioDB", 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("userData")) {
    db.createObjectStore("userData", { keyPath: "id" });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  checkExistingUser();
};

const themes = {
  indigo: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', primary: '#4f46e5', muted: '#64748b', border: '#e2e8f0', tagBg: '#e0e7ff', tagText: '#3730a3' },
  dark: { bg: '#0f172a', card: '#1e293b', text: '#f8fafc', primary: '#818cf8', muted: '#94a3b8', border: '#334155', tagBg: '#312e81', tagText: '#c7d2fe' },
  emerald: { bg: '#f0fdf4', card: '#ffffff', text: '#064e3b', primary: '#059669', muted: '#047857', border: '#bbf7d0', tagBg: '#d1fae5', tagText: '#065f46' },
  warm: { bg: '#fffbeb', card: '#ffffff', text: '#451a03', primary: '#d97706', muted: '#78350f', border: '#fde68a', tagBg: '#fef3c7', tagText: '#92400e' }
};

function toggleConfigModal() {
  const modal = document.getElementById("config-modal");
  modal.classList.toggle("hidden");
}

function applyTheme(themeName) {
  document.body.setAttribute("data-theme", themeName);
}

// --- AUTENTICACIÓN GOOGLE ---
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(window.atob(base64));
}

function handleCredentialResponse(response) {
  const user = parseJwt(response.credential);
  const userData = {
    id: "currentUser",
    name: user.name,
    email: user.email,
    picture: user.picture
  };

  saveToIndexedDB("userData", userData, () => {
    showApp(userData);
    loadPortfolioData();
  });
}

function checkExistingUser() {
  getFromIndexedDB("userData", "currentUser", (user) => {
    if (user) {
      showApp(user);
    } else {
      // Si no hay sesión iniciada previamente, mantenemos la pantalla de login limpia
      document.getElementById("login-screen").classList.remove("hidden");
      document.getElementById("app-screen").classList.add("hidden");
    }
    loadPortfolioData();
  });
}

function showApp(user) {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("user-avatar").src = user.picture || "https://via.placeholder.com/50";
  document.getElementById("user-name").innerText = user.name || "Usuario";
  document.getElementById("user-email").innerText = user.email || "";
  
  const profNameInput = document.getElementById("prof-name");
  if (profNameInput && !profNameInput.value) {
    profNameInput.value = user.name || "";
  }
}

function logout() {
  deleteFromIndexedDB("userData", "currentUser", () => {
    location.reload();
  });
}

// --- MANEJO DE INDEXEDDB ---
function saveToIndexedDB(storeName, data, callback) {
  if (!db) return;
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(data);
  tx.oncomplete = callback;
}

function getFromIndexedDB(storeName, key, callback) {
  if (!db) return callback(null);
  const tx = db.transaction(storeName, "readonly");
  const request = tx.objectStore(storeName).get(key);
  request.onsuccess = () => callback(request.result);
  request.onerror = () => callback(null);
}

function deleteFromIndexedDB(storeName, key, callback) {
  if (!db) return;
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  tx.oncomplete = callback;
}

// --- TRABAJOS, CASOS DE ÉXITO O PROYECTOS ---
function addProjectInput(title = "", description = "", link = "", image = "") {
  const container = document.getElementById("projects-list");
  const div = document.createElement("div");
  div.className = "project-item";
  
  div.innerHTML = `
    <label>Imagen / Documento de Portada (Opcional):</label>
    <input type="file" accept="image/*" onchange="previewImage(this)">
    <input type="hidden" class="proj-img-base64" value="${image}">
    <img class="proj-preview" src="${image}" style="${image ? 'display:block;' : ''}">
    
    <label>Título del Caso, Proyecto o Experiencia:</label>
    <input type="text" class="proj-title" placeholder="Ej. Reestructuración de Pasivos Fiscales 2025" value="${title}" required>
    
    <label>Explicación / Detalle de la Gestión:</label>
    <textarea class="proj-desc" placeholder="Describe qué problema resolviste, las acciones tomadas y los resultados obtenidos..." rows="3" required>${description}</textarea>
    
    <label>Enlace Adjunto o Informe (Opcional):</label>
    <input type="url" class="proj-link" placeholder="Ej. https://enlace-a-documento.com" value="${link}">
    
    <button type="button" style="background:#fee2e2;color:#dc2626;" onclick="this.parentElement.remove()">Eliminar Entrada</button>
  `;
  container.appendChild(div);
}

function previewImage(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const container = input.parentElement;
      container.querySelector(".proj-img-base64").value = e.target.result;
      const img = container.querySelector(".proj-preview");
      img.src = e.target.result;
      img.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
}

function saveAndGenerate(event) {
  event.preventDefault();

  const name = document.getElementById("prof-name").value;
  const title = document.getElementById("prof-title").value;
  const about = document.getElementById("prof-about").value;
  const skills = document.getElementById("prof-skills").value;
  const selectedTheme = document.getElementById("theme-select").value;

  const projectElements = document.querySelectorAll(".project-item");
  const projects = Array.from(projectElements).map(el => ({
    title: el.querySelector(".proj-title").value,
    description: el.querySelector(".proj-desc").value,
    link: el.querySelector(".proj-link").value,
    image: el.querySelector(".proj-img-base64").value
  }));

  const portfolioData = { id: "portfolioData", name, title, about, skills, selectedTheme, projects };

  saveToIndexedDB("userData", portfolioData, () => {
    downloadHTML(name, title, about, skills, selectedTheme, projects);
  });
}

function loadPortfolioData() {
  getFromIndexedDB("userData", "portfolioData", (data) => {
    if (!data) return;
    if (data.name) document.getElementById("prof-name").value = data.name;
    document.getElementById("prof-title").value = data.title || "";
    document.getElementById("prof-about").value = data.about || "";
    document.getElementById("prof-skills").value = data.skills || "";
    if (data.selectedTheme) {
      document.getElementById("theme-select").value = data.selectedTheme;
      applyTheme(data.selectedTheme);
    }
    if (data.projects) {
      document.getElementById("projects-list").innerHTML = "";
      data.projects.forEach(p => addProjectInput(p.title, p.description, p.link, p.image));
    }
  });
}

// --- GENERACIÓN DEL PORTAFOLIO EN HTML ---
function downloadHTML(name, title, about, skills, themeKey, projects) {
  const t = themes[themeKey] || themes.indigo;

  const skillsHTML = skills ? skills.split(',')
    .map(s => `<span class="skill-tag">${s.trim()}</span>`)
    .join('') : '';

  const projectsHTML = projects.map(p => `
    <div class="card">
      ${p.image ? `<img src="${p.image}" class="proj-img" alt="${p.title}">` : ''}
      <h3>${p.title}</h3>
      <p class="proj-desc">${p.description}</p>
      ${p.link ? `<a href="${p.link}" target="_blank" class="proj-link">Ver Documento / Enlace &rarr;</a>` : ''}
    </div>
  `).join('');

  const fullHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portafolio Profesional - ${name}</title>
  <link rel="icon" href="icono.valija}.jpg" type="image/jpeg">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
    body { background-color: ${t.bg}; color: ${t.text}; padding: 60px 20px; max-width: 720px; margin: 0 auto; line-height: 1.6; }
    .header { margin-bottom: 40px; }
    h1 { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 6px; }
    .title { color: ${t.primary}; font-weight: 600; font-size: 1.2rem; margin-bottom: 20px; }
    .about { color: ${t.muted}; font-size: 1.05rem; white-space: pre-line; margin-bottom: 24px; }
    .skills-container { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
    .skill-tag { background: ${t.tagBg}; color: ${t.tagText}; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
    h2 { font-size: 1.4rem; font-weight: 600; margin-bottom: 24px; border-bottom: 2px solid ${t.border}; padding-bottom: 8px; }
    .card { background: ${t.card}; padding: 24px; border-radius: 12px; border: 1px solid ${t.border}; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); }
    .proj-img { width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 16px; border: 1px solid ${t.border}; }
    .card h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; color: ${t.text}; }
    .proj-desc { color: ${t.muted}; font-size: 0.95rem; white-space: pre-line; margin-bottom: 16px; }
    .proj-link { color: ${t.primary}; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: inline-flex; align-items: center; }
    .proj-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${name}</h1>
    <div class="title">${title}</div>
    <p class="about">${about}</p>
    ${skillsHTML ? `<div class="skills-container">${skillsHTML}</div>` : ''}
  </div>
  <h2>Experiencia, Trabajos y Casos de Éxito</h2>
  ${projectsHTML}
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `portafolio-${name.toLowerCase().replace(/\s+/g, '-')}.html`;
  a.click();
}