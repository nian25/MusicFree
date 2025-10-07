// 公共逻辑：API、主题、localStorage 辅助函数
const API_BASE = "https://sdkapi.hhlqilongzhu.cn/api/hema_duanju/?key=Dragon8F5AA09B61EAC9780BC7C2BBF1972680";

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){}
}

function initTheme() {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'dark') document.body.classList.add('dark');
  } catch(e){}
}

function saveHistory(book_id, video_id, title) {
  try {
    localStorage.setItem('last_play', JSON.stringify({ book_id, video_id, title }));
  } catch(e){}
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('last_play') || 'null');
  } catch(e){ return null; }
}

function saveCurrentBook(book) {
  try { localStorage.setItem('current_book', JSON.stringify(book)); } catch(e){}
}

function getCurrentBook() {
  try { return JSON.parse(localStorage.getItem('current_book') || 'null'); } catch(e){ return null; }
}

async function fetchJSON(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('网络错误: ' + res.status);
  const j = await res.json();
  return j;
}

initTheme();

// small helper to safely parse local current_video
function getCurrentVideo() {
  try { return JSON.parse(localStorage.getItem('current_video') || 'null'); } catch(e){ return null; }
}
function saveCurrentVideo(v) {
  try { localStorage.setItem('current_video', JSON.stringify(v)); } catch(e){}
}
