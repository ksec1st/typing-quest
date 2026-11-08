
/* =========================================
   TYPING QUEST v1.0
========================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbwe3xTtSYlpDsLcvE0Uh9LuIOFxs4P0SVWs2gRqeSm8XuUEiRMeKLgIl8p5-ooRvYZ8LA/exec";

const $ = id => document.getElementById(id);

const sentences = [
  { jp: "今日は楽しくゲームをしよう", ro: "kyouha tanoshiku ge-mu wo shiyou" },
  { jp: "冒険の旅に出発しよう", ro: "bouken no tabi ni shuppatsu shiyou" },
  { jp: "勇者は魔王を倒すために旅立った", ro: "yuusha ha maou wo taosu tameni tabidatta" },
  { jp: "仲間と一緒に世界を救おう", ro: "nakama to isshoni sekai wo sukuou" },
  { jp: "毎日練習すれば上達できる", ro: "mainichi renshuu sureba joutatsu dekiru" },
  { jp: "森の奥には大きな城がある", ro: "mori no oku niha ookina shiro ga aru" },
  { jp: "強い敵にも恐れず立ち向かう", ro: "tsuyoi teki nimo osorezu tachimukau" },
  { jp: "最後まで諦めないことが大切だ", ro: "saigomade akiramenai kotoga taisetsu da" },
  { jp: "新しい冒険が今始まる", ro: "atarashii bouken ga ima hajimaru" },
  { jp: "世界の平和を守るために戦う", ro: "sekai no heiwa wo mamoru tameni tatakau" }
];

const enemies = [
  { name: "スライム", icon: "🟢", hp: 50, exp: 20, gold: 10, level: 1 },
  { name: "グリーンウルフ", icon: "🐺", hp: 90, exp: 35, gold: 20, level: 2 },
  { name: "ゴブリン", icon: "👺", hp: 130, exp: 50, gold: 30, level: 3 },
  { name: "キングスライム", icon: "👑", hp: 300, exp: 120, gold: 100, level: 5, boss: true }
];

const defaultPlayer = () => ({
  name: "",
  level: 1,
  exp: 0,
  hp: 100,
  maxHp: 100,
  gold: 0,
  kills: 0,
  totalDamage: 0,
  totalTyped: 0,
  totalMiss: 0,
  weapon: 0
});

let player = defaultPlayer();
let token = "";
let currentEnemy = null;
let enemyHp = 0;
let enemyMaxHp = 0;
let enemyIndex = 0;
let currentSentence = null;
let typed = "";
let combo = 0;
let maxCombo = 0;
let damageThisBattle = 0;
let battleMiss = 0;
let battleTyped = 0;
let battleStarted = false;
let battleFinished = false;
let lastAttack = Date.now();
let attackTimer = null;
let battleTimer = null;
let elapsedSeconds = 0;
let saveTimer = null;
let isBusy = false;

// ---------- 画面切り替え ----------

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  $(id).classList.add("active");
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2600);
}

// ---------- オンライン通信 ----------

function api(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (!API_URL || API_URL.startsWith("ここに")) {
      reject(new Error("オンライン設定が未完了です。Code.gsを公開してください。"));
      return;
    }

    const callback = "tqCallback_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("サーバーとの通信がタイムアウトしました。"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
    }

    window[callback] = result => {
      cleanup();
      if (result && result.success) resolve(result);
      else reject(new Error(result?.message || "通信に失敗しました。"));
    };

    const params = new URLSearchParams({
      action,
      callback,
      payload: JSON.stringify(data)
    });

    script.src = API_URL + "?" + params.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error("サーバーに接続できませんでした。"));
    };

    document.body.appendChild(script);
  });
}

// ---------- 登録・ログイン ----------

$("start-button").onclick = () => showScreen("register-screen");
$("continue-button").onclick = () => showScreen("login-screen");
$("back-title").onclick = () => showScreen("title-screen");
$("back-title-login").onclick = () => showScreen("title-screen");

$("register-button").onclick = async () => {
  if (isBusy) return;
  const name = $("player-name").value.trim();
  const pin = $("player-pin").value;

  if (name.length < 2 || name.length > 12) {
    $("register-message").textContent = "名前は2〜12文字で入力してください。";
    return;
  }
  if (pin.length < 4) {
    $("register-message").textContent = "パスワードは4文字以上にしてください。";
    return;
  }

  isBusy = true;
  $("register-message").textContent = "登録しています...";

  try {
    const result = await api("register", { name, pin });
    token = result.token;
    player = { ...defaultPlayer(), ...result.player };
    enterGame();
    await saveGame();
    toast("冒険者登録が完了しました！");
  } catch (e) {
    $("register-message").textContent = e.message;
  } finally {
    isBusy = false;
  }
};

$("login-button").onclick = async () => {
  if (isBusy) return;
  const name = $("login-name").value.trim();
  const pin = $("login-pin").value;

  if (!name || !pin) {
    $("login-message").textContent = "名前とパスワードを入力してください。";
    return;
  }

  isBusy = true;
  $("login-message").textContent = "ログインしています...";

  try {
    const result = await api("login", { name, pin });
    token = result.token;
    player = { ...defaultPlayer(), ...result.player };
    enterGame();
    toast("冒険を再開しました！");
  } catch (e) {
    $("login-message").textContent = e.message;
  } finally {
    isBusy = false;
  }
};

function enterGame() {
  showScreen("game-screen");
  updatePlayerUI();
  resetBattleUI();
}

// ---------- プレイヤー表示 ----------

function attackPower() {
  return 1 + (player.level - 1) + (player.weapon || 0);
}

function expNeeded() {
  return player.level * 100;
}

function updatePlayerUI() {
  $("display-name").textContent = player.name;
  $("player-level").textContent = player.level;
  $("exp-label").textContent = `${player.exp} / ${expNeeded()}`;
  $("exp-bar").style.width =
    Math.min(100, player.exp / expNeeded() * 100) + "%";

  $("hp-label").textContent = `${player.hp} / ${player.maxHp}`;
  $("player-hp-bar").style.width =
    Math.max(0, player.hp / player.maxHp * 100) + "%";

  $("attack-stat").textContent = attackPower();
  $("gold-stat").textContent = player.gold + " G";
  $("kill-stat").textContent = player.kills;
}

function addExp(amount) {
  player.exp += amount;
  let leveled = false;

  while (player.exp >= expNeeded()) {
    player.exp -= expNeeded();
    player.level++;
    player.maxHp += 20;
    player.hp = player.maxHp;
    leveled = true;
  }

  updatePlayerUI();

  if (leveled) toast("LEVEL UP！ レベル " + player.level + "！");
}

// ---------- 敵の出現 ----------

function getEnemy() {
  const level = player.level;
  let pool;

  if (level >= 5) {
    pool = enemies.slice(1);
  } else if (level >= 3) {
    pool = enemies.slice(0, 3);
  } else {
    pool = enemies.slice(0, 2);
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  const scale = Math.max(0, Math.floor((level - selected.level) / 2));

  return {
    ...selected,
    hp: selected.hp + scale * 25,
    exp: selected.exp + scale * 8,
    gold: selected.gold + scale * 4
  };
}

function spawnEnemy() {
  stopBattleTimers();

  currentEnemy = getEnemy();
  enemyMaxHp = currentEnemy.hp;
  enemyHp = enemyMaxHp;

  battleStarted = false;
  battleFinished = false;
  combo = 0;
  maxCombo = 0;
  damageThisBattle = 0;
  battleMiss = 0;
  battleTyped = 0;
  elapsedSeconds = 0;

  $("enemy-sprite").textContent = currentEnemy.icon;
  $("enemy-name").textContent = currentEnemy.name;
  $("enemy-level").textContent = currentEnemy.level;
  $("enemy-count").textContent = (player.kills + 1) + "体目";

  $("enemy-unit").classList.remove("dead");
  $("enemy-hp-bar").style.width = "100%";
  $("enemy-hp-label").textContent = `${enemyHp} / ${enemyMaxHp}`;

  $("battle-button").disabled = false;
  $("battle-button").textContent = "⚔ BATTLE START";
  $("next-enemy-button").disabled = true;

  resetBattleUI();
}

function resetBattleUI() {
  typed = "";
  $("typing-input").value = "";
  $("typing-input").disabled = true;
  $("typing-hint").textContent = "敵を出現させて戦闘を開始しよう！";
  $("typing-progress-bar").style.width = "0%";
  $("sentence-display").textContent = "冒険の準備はできたか？";
  $("romaji-display").textContent = "BATTLE READY";
  updateBattleUI();
}

// ---------- タイピング難易度 ----------

function selectSentence() {
  const difficulty = player.level >= 8 ? 3 : player.level >= 4 ? 2 : player.level >= 2 ? 1 : 0;
  const pools = [
    sentences.filter(s => s.ro.length <= 25),
    sentences.filter(s => s.ro.length >= 15),
    sentences.filter(s => s.ro.length >= 20),
    sentences
  ];

  const pool = pools[difficulty].length ? pools[difficulty] : sentences;
  currentSentence = pool[Math.floor(Math.random() * pool.length)];

  $("difficulty-label").textContent =
    ["BEGINNER", "NORMAL", "ADVANCED", "EXPERT"][difficulty];
  $("sentence-display").textContent = currentSentence.jp;
  typed = ""; updateTypingDisplay();
}

// ---------- 戦闘開始 ----------

$("battle-button").onclick = () => {
  if (battleStarted || battleFinished) return;
  if (player.hp <= 0) {
    toast("HPがありません。休憩して回復してください。");
    return;
  }

  battleStarted = true;
  lastAttack = Date.now();
  selectSentence();

  $("typing-input").disabled = false;
  $("typing-input").focus();
  $("typing-hint").textContent = "文章を正確に入力しよう！";
  $("battle-button").disabled = true;
  $("battle-button").textContent = "⚔ IN BATTLE";

  attackTimer = setInterval(enemyAttack, 5000);
  battleTimer = setInterval(() => {
    elapsedSeconds++;
    updateBattleUI();
  }, 1000);
};


/* ---------- タイピング処理 修正版 ---------- */

function getTypingTarget() {
  return currentSentence.ro.replace(/\s/g, "");
}

function updateTypingDisplay() {
  const target = getTypingTarget();

  $("romaji-display").innerHTML = `
    <span style="color:#78d69a">${target.slice(0, typed.length)}</span><span style="color:#ffffff">${target.slice(typed.length)}</span>
  `;

  $("typing-progress-bar").style.width =
    (typed.length / target.length * 100) + "%";
}

$("typing-input").addEventListener("input", event => {
  if (!battleStarted || battleFinished) return;

  const target = getTypingTarget();

  // 入力値をローマ字のみに統一
  const value = event.target.value.toLowerCase().replace(/[^a-z]/g, "");

  // 既に入力した文字を消せないようにする
  if (value.length < typed.length) {
    event.target.value = typed;
    return;
  }

  // 正しい入力か確認
  if (!target.startsWith(value)) {
    battleMiss++;
    player.totalMiss++;
    combo = 0;

    event.target.value = typed;

    updateBattleUI();
    updateTypingDisplay();

    $("typing-hint").textContent = "MISS！もう一度確認しよう！";
    return;
  }

  // 新しく入力された文字数
  const added = value.length - typed.length;

  typed = value;

  battleTyped += added;
  player.totalTyped += added;

  // 攻撃処理
  const damage = added * attackPower();

  enemyHp = Math.max(0, enemyHp - damage);

  damageThisBattle += damage;
  player.totalDamage += damage;

  combo += added;
  maxCombo = Math.max(maxCombo, combo);

  event.target.value = typed;

  showDamage(damage);
  updateEnemyUI();
  updateBattleUI();
  updateTypingDisplay();
  playAttackAnimation();

  // 敵を倒した場合
  if (enemyHp <= 0) {
    victory();
    return;
  }

  // 文章を最後まで入力した場合
  if (typed.length === target.length) {
    combo += 5;
    maxCombo = Math.max(maxCombo, combo);

    typed = "";
    $("typing-input").value = "";

    selectSentence();

    $("typing-hint").textContent =
      "文章クリア！次の文章へ！";

    updateTypingDisplay();
    updateBattleUI();
  }
});


// ---------- 敵の反撃 ----------

function enemyAttack() {
  if (!battleStarted || battleFinished) return;

  const damage = Math.max(2, currentEnemy.level * 3 + 2);
  player.hp = Math.max(0, player.hp - damage);

  $("typing-hint").textContent = `敵の攻撃！ ${damage} ダメージを受けた！`;
  updatePlayerUI();

  if (player.hp <= 0) {
    defeat();
  }
}

// ---------- 戦闘表示 ----------

function updateBattleUI() {
  $("combo-value").textContent = combo;
  $("damage-value").textContent = damageThisBattle;

  const accuracy = battleTyped + battleMiss > 0
    ? battleTyped / (battleTyped + battleMiss) * 100
    : 100;

  $("accuracy-value").textContent = accuracy.toFixed(1) + "%";

  $("speed-value").textContent = elapsedSeconds > 0
    ? Math.round(battleTyped / elapsedSeconds * 60)
    : 0;

  $("mistake-count").textContent = "MISS : " + battleMiss;

  if (currentSentence) {
    $("typing-progress-bar").style.width =
      (typed.length / currentSentence.ro.length * 100) + "%";
  }
}

// ---------- 勝利・敗北 ----------

function stopBattleTimers() {
  clearInterval(attackTimer);
  clearInterval(battleTimer);
  attackTimer = null;
  battleTimer = null;
}

function finishBattle() {
  battleStarted = false;
  battleFinished = true;
  stopBattleTimers();
  $("typing-input").disabled = true;
  $("battle-button").disabled = true;
  $("next-enemy-button").disabled = false;
}

function victory() {
  finishBattle();
  $("enemy-unit").classList.add("dead");

  player.kills++;
  player.hp = Math.min(player.maxHp, player.hp + 10);

  const expReward = currentEnemy.exp;
  const goldReward = currentEnemy.gold;

  addExp(expReward);
  player.gold += goldReward;
  updatePlayerUI();

  const accuracy = battleTyped + battleMiss > 0
    ? battleTyped / (battleTyped + battleMiss) * 100
    : 100;

  $("result-title").textContent = "VICTORY!";
  $("result-exp").textContent = "+" + expReward;
  $("result-gold").textContent = "+" + goldReward;
  $("result-accuracy").textContent = accuracy.toFixed(1) + "%";
  $("result-combo").textContent = maxCombo;
  $("result-message").textContent = "モンスターを討伐しました！ HPが10回復しました。";
  $("result-modal").classList.add("show");

  saveGame().catch(e => toast("オンライン保存に失敗：" + e.message));
}

function defeat() {
  finishBattle();

  $("result-title").textContent = "DEFEAT...";
  $("result-exp").textContent = "+0";
  $("result-gold").textContent = "+0";
  $("result-accuracy").textContent = "—";
  $("result-combo").textContent = maxCombo;
  $("result-message").textContent = "力尽きてしまった... HPを回復して再挑戦しよう。";
  $("result-modal").classList.add("show");

  saveGame().catch(() => {});
}

$("result-close").onclick = () => {
  $("result-modal").classList.remove("show");
  if (battleFinished && enemyHp <= 0) {
    $("next-enemy-button").disabled = false;
  }
};

$("next-enemy-button").onclick = () => {
  if (!battleFinished) return;
  spawnEnemy();
};

$("save-button").onclick = () => {
  saveGame().then(() => toast("冒険データを保存しました！"))
    .catch(e => toast(e.message));
};

// ---------- オンライン保存 ----------

function saveGame() {
  if (!token) return Promise.reject(new Error("ログインしてください。"));

  const data = {
    token,
    player: {
      name: player.name,
      level: player.level,
      exp: player.exp,
      hp: player.hp,
      maxHp: player.maxHp,
      gold: player.gold,
      kills: player.kills,
      totalDamage: player.totalDamage,
      totalTyped: player.totalTyped,
      totalMiss: player.totalMiss,
      weapon: player.weapon
    }
  };

  $("connection-status").textContent = "● SAVING";

  return api("save", data).then(result => {
    $("connection-status").textContent = "● ONLINE";
    return result;
  }).catch(error => {
    $("connection-status").textContent = "● OFFLINE";
    throw error;
  });
}

// ---------- ログアウト ----------

$("logout-button").onclick = async () => {
  if (!confirm("ログアウトしますか？")) return;

  try {
    await saveGame();
  } catch (e) {
    toast("保存できませんでした：" + e.message);
    return;
  }

  token = "";
  player = defaultPlayer();
  stopBattleTimers();
  battleStarted = false;
  showScreen("title-screen");
};

// ---------- 初期化 ----------

window.addEventListener("load", () => {
  spawnEnemy();
});
