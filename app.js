const API_BASE = "https://sdkapi.hhlqilongzhu.cn/api/hema_duanju/?key=Dragon8F5AA09B61EAC9780BC7C2BBF1972680";

// 切换夜间模式
function toggleTheme() {
  const current = document.body.classList.toggle("dark");
  localStorage.setItem("theme", current ? "dark" : "light");
}

// 初始化主题
function initTheme() {
  const theme = localStorage.getItem("theme");
  if (theme === "dark") document.body.classList.add("dark");
}

// 保存播放记录
function saveHistory(book_id, video_id, title) {
  localStorage.setItem("last_play", JSON.stringify({ book_id, video_id, title }));
}

// 获取播放记录
function getHistory() {
  return JSON.parse(localStorage.getItem("last_play") || "null");
}

// 保存当前剧本信息
function saveCurrentBook(book) {
  localStorage.setItem("current_book", JSON.stringify(book));
}

function getCurrentBook() {
  return JSON.parse(localStorage.getItem("current_book") || "null");
}

// 简化 fetch
async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
}

initTheme();
