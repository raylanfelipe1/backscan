import { createClient } from "@supabase/supabase-js";
import { readPublicConfig } from "./config.js";
import "./styles.css";

const root = document.getElementById("app");
const config = readPublicConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const configured = Boolean(config);
const db = configured ? createClient(config.url, config.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;
let currentUser = null;
let incidents = [];
let activeIncident = null;

function el(tag, className = "", content = "") {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== null && content !== undefined) result.textContent = String(content);
  return result;
}
function add(parent, ...children) {
  children.forEach((child) => parent.appendChild(child));
  return parent;
}
function button(label, callback, style = "btn") {
  const b = el("button", style, label);
  b.type = "button";
  b.addEventListener("click", callback);
  return b;
}
function field(label, type = "text", required = false) {
  const wrap = el("label", "field");
  const span = el("span", "", label);
  const input = type === "textarea" ? el("textarea") : el("input");
  if (type !== "textarea") input.type = type;
  input.required = required;
  if (type === "textarea") input.rows = 3;
  add(wrap, span, input);
  return {wrap, input};
}
function setNotice(place, message, bad = false) {
  place.textContent = message;
  place.className = bad ? "notice error" : "notice";
}
function shell() {
  root.replaceChildren();
  const header = el("header", "topbar");
  const brand = el("div", "brand");
  add(brand, el("span", "logo", "◈"), el("span", "", "BackScan"), el("span", "version", "V0.1"));
  header.appendChild(brand);
  root.appendChild(header);
  return header;
}
function splash(message = "") {
  shell();
  const view = el("main", "page center");
  const card = el("section", "panel auth");
  add(card, el("div", "eyebrow", "PROTEÇÃO DE EVIDÊNCIAS"),
    el("h1", "", "Central de incidentes"),
    el("p", "muted", "Registre ameaças, reúna evidências e prepare relatórios em um espaço privado."));
  if (!configured) {
    add(card, el("p", "notice", "Serviço em preparação. O painel privado ainda não está disponível."));
    view.appendChild(card); root.appendChild(view); return;
  }
  const form = el("form", "stack");
  const email = field("E-mail", "email", true);
  const password = field("Senha", "password", true);
  password.input.autocomplete = "current-password";
  email.input.autocomplete = "email";
  const send = el("button", "btn primary", "Entrar no painel");
  send.type = "submit";
  const note = el("p", message ? "notice error" : "notice", message || "Acesso exclusivo para contas autorizadas. Não há cadastro público.");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    send.disabled = true; send.textContent = "Entrando...";
    const { error } = await db.auth.signInWithPassword({
      email: email.input.value.trim(), password: password.input.value
    });
    send.disabled = false; send.textContent = "Entrar no painel";
    if (error) setNotice(note, "Não foi possível entrar. Verifique suas credenciais.", true);
    // SIGNED_IN aciona a navegação pelo observador da sessão.
  });
  add(form, email.wrap, password.wrap, send);
  add(card, form, note);
  add(view, card); root.appendChild(view);
}

async function route() {
  if (!configured) { splash(); return; }
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) { currentUser = null; splash(); return; }
  currentUser = user;
  const { data: authorization, error: authorizationError } = await db.from("authorized_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (authorizationError || !authorization) {
    currentUser = null;
    splash("Esta conta não tem acesso ao painel. Solicite autorização ao administrador.");
    return;
  }
  await renderDashboard();
}
async function fetchIncidents() {
  const { data, error } = await db.from("incidents").select("*").order("created_at", {ascending:false}).limit(200);
  if (error) throw error;
  incidents = data || [];
}

async function renderDashboard() {
  shell();
  const page = el("main", "page");
  const headline = el("div", "heading");
  const left = el("div");
  add(left, el("div", "eyebrow", "PAINEL PRIVADO"), el("h1", "", "Registro de incidentes"),
    el("p", "muted", "Acesso restrito • Evidências protegidas por usuário"));
  add(headline, left, button("Sair", async () => {
    const { error } = await db.auth.signOut();
    if (error) { alert("Não foi possível encerrar a sessão. Tente novamente."); return; }
    currentUser = null; activeIncident = null; incidents = []; splash();
  }, "btn ghost"));
  add(page, headline);
  const notice = el("p", "notice", "");
  page.appendChild(notice);
  try { await fetchIncidents(); } catch (err) {
    setNotice(notice, "Não foi possível carregar os registros. Tente novamente em instantes.", true);
    incidents = [];
  }
  const metrics = el("div", "metrics");
  const a = el("div", "metric"); add(a, el("strong", "", incidents.length), el("span", "", "Incidentes registrados"));
  const b = el("div", "metric"); add(b, el("strong", "", incidents.filter(x=>x.status==="aberto").length), el("span", "", "Em acompanhamento"));
  add(metrics, a, b);
  page.appendChild(metrics);
  const columns = el("div", "columns");
  const create = el("section", "panel");
  add(create, el("h2", "", "Novo incidente"), el("p", "muted", "Descreva o ocorrido sem incluir dados pessoais desnecessários."));
  const form = el("form", "stack");
  const contact = field("Contato ou identificador do remetente", "text", true);
  const channel = field("Canal (WhatsApp, SMS, outro)", "text", true);
  const title = field("Resumo", "text", true);
  const detail = field("Relato / descrição", "textarea", true);
  const occurred = field("Data e hora do incidente", "datetime-local");
  const save = el("button", "btn primary", "Salvar incidente"); save.type = "submit";
  const formNote = el("p", "notice", "");
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); save.disabled = true;
    const {error} = await db.from("incidents").insert({
      owner_id: currentUser.id, contact: contact.input.value.trim().slice(0,160),
      channel: channel.input.value.trim().slice(0,60),
      title: title.input.value.trim().slice(0,180),
      details: detail.input.value.trim().slice(0,4000),
      occurred_at: occurred.input.value ? new Date(occurred.input.value).toISOString() : new Date().toISOString()
    });
    save.disabled = false;
    if (error) setNotice(formNote, "Não foi possível salvar: " + error.message, true);
    else await renderDashboard();
  });
  add(form, contact.wrap, channel.wrap, title.wrap, detail.wrap, occurred.wrap, save, formNote);
  create.appendChild(form);
  const history = el("section", "panel");
  const row = el("div", "section-head");
  add(row, el("h2", "", "Histórico"), button("Exportar CSV", downloadCsv, "btn outline"));
  add(history, row);
  const list = el("div", "incident-list");
  if (!incidents.length) list.appendChild(el("p", "muted", "Nenhum incidente registrado."));
  incidents.forEach((item) => {
    const card = el("div", "incident");
    const meta = el("div", "incident-meta");
    add(meta, el("span", "pill", item.status === "fechado" ? "Fechado" : "Aberto"),
      el("time", "", new Date(item.occurred_at).toLocaleString("pt-BR")));
    add(card, meta, el("h3", "", item.title),
      el("p", "muted small", item.channel + " · " + item.contact),
      button("Consultar e anexar provas", () => showIncident(item), "btn outline small-btn"));
    list.appendChild(card);
  });
  history.appendChild(list);
  add(columns, create, history);
  page.appendChild(columns);
  const evidence = el("section", "panel evidence");
  evidence.id = "evidence";
  add(evidence, el("h2", "", "Evidências"), el("p", "muted", "Selecione um incidente do histórico para anexar ou consultar arquivos."));
  page.appendChild(evidence);
  const footer = el("footer", "footer", "BackScan • Proteção e organização de evidências. O sistema não identifica quem controla um número de telefone.");
  page.appendChild(footer);
  root.appendChild(page);
  if (activeIncident) {
    const selected = incidents.find(x=>x.id === activeIncident);
    if (selected) await showIncident(selected, false);
  }
}

async function showIncident(incident, scroll = true) {
  activeIncident = incident.id;
  const panel = document.getElementById("evidence");
  panel.replaceChildren();
  add(panel, el("h2", "", "Provas • " + incident.title),
    el("p", "muted", incident.details));
  const fileLabel = el("label", "field");
  const input = el("input"); input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,application/pdf,text/plain";
  add(fileLabel, el("span", "", "Anexar captura, documento ou texto (máximo 10 MB)"), input);
  const status = el("p", "notice", "");
  const send = button("Anexar evidência", async () => {
    const file = input.files?.[0];
    if (!file) { setNotice(status, "Selecione um arquivo.", true); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice(status, "O limite é de 10 MB.", true); return; }
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"];
    if (!allowed.includes(file.type)) { setNotice(status, "Formato não permitido.", true); return; }
    send.disabled = true;
    try {
      const hashBytes = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(hashBytes), n=>n.toString(16).padStart(2,"0")).join("");
      const path = currentUser.id + "/" + incident.id + "/" + crypto.randomUUID();
      const uploaded = await db.storage.from("backscan-evidence").upload(path, file, {
        contentType: file.type, upsert: false
      });
      if (uploaded.error) {
        setNotice(status, "Não foi possível enviar o arquivo. Verifique sua conexão e sua autorização.", true);
        return;
      }
      const recorded = await db.from("evidence").insert({
        incident_id: incident.id, owner_id: currentUser.id,
        file_path: path, file_name: file.name.slice(0,240), sha256
      });
      if (recorded.error) {
        const cleanup = await db.storage.from("backscan-evidence").remove([path]);
        setNotice(status, cleanup.error
          ? "O registro falhou e o arquivo enviado não pôde ser removido. Informe o administrador."
          : "Não foi possível registrar a evidência. O arquivo enviado foi removido; tente novamente.", true);
      } else {
        input.value = "";
        setNotice(status, "Evidência anexada; hash SHA-256 registrado.");
        await listEvidence(incident.id, panel);
      }
    } catch {
      setNotice(status, "A operação foi interrompida. Consulte a lista de evidências antes de tentar novamente.", true);
    } finally {
      send.disabled = false;
    }
  }, "btn primary");
  add(panel, fileLabel, send, status);
  await listEvidence(incident.id, panel);
  if (scroll) panel.scrollIntoView({behavior:"smooth", block:"start"});
}
async function listEvidence(incidentId, panel) {
  panel.querySelector(".files")?.remove();
  const box = el("div", "files");
  const {data, error} = await db.from("evidence").select("id,file_name,file_path,sha256,created_at")
    .eq("incident_id", incidentId).order("created_at", {ascending:false});
  if (error) { box.appendChild(el("p", "notice error", "Não foi possível listar as evidências.")); panel.appendChild(box); return; }
  if (!data.length) box.appendChild(el("p", "muted", "Nenhum arquivo anexado."));
  data.forEach((file) => {
    const item = el("div", "file-item");
    const info = el("div");
    add(info, el("strong", "", file.file_name),
      el("small", "hash", "SHA-256: " + file.sha256),
      el("small", "muted", new Date(file.created_at).toLocaleString("pt-BR")));
    const open = button("Gerar acesso ao arquivo", async () => {
      const {data: signed, error: err} = await db.storage.from("backscan-evidence")
        .createSignedUrl(file.file_path, 60);
      if (err) { alert("Arquivo indisponível."); return; }
      const link = document.createElement("a");
      link.href = signed.signedUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.className = "signed-link";
      link.textContent = "Abrir arquivo (válido por 60 segundos)";
      item.querySelector(".signed-link")?.remove();
      open.after(link);
      window.setTimeout(() => link.remove(), 60000);
    }, "btn outline small-btn");
    add(item, info, open); box.appendChild(item);
  });
  panel.appendChild(box);
}
function downloadCsv() {
  const rows = [["id","data","contato","canal","resumo","relato","status"],
    ...incidents.map(x=>[x.id,x.occurred_at,x.contact,x.channel,x.title,x.details,x.status])];
  const csv = rows.map(row=>row.map(value=>{
    const text = String(value ?? "");
    const neutral = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return '"' + neutral.replaceAll('"','""') + '"';
  }).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = href; link.download = "backscan-incidentes.csv";
  link.click(); URL.revokeObjectURL(href);
}

if (configured) {
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") window.setTimeout(route, 0);
  });
}
route();
