// =====================================================
// 39場面のSVG画像生成
// カテゴリごとのテンプレート × 情報パネルデータ
// =====================================================

type InfoRow = { icon: string; label: string; value: string; color: string };

function golfSvg(rows: InfoRow[], elements: string): string {
  const panel = rows
    .map(
      (r, i) =>
        `<text x="58" y="${74 + i * 28}" fill="#555" font-size="15">${r.icon} ${r.label}</text>
  <text x="278" y="${74 + i * 28}" text-anchor="end" fill="${r.color}" font-size="${i === 0 ? 19 : 16}" font-weight="bold">${r.value}</text>`
    )
    .join("\n  ");
  const panelH = 50 + rows.length * 28;
  return `<svg width="100%" height="500" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans JP',Arial,sans-serif">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5B9EC9"/><stop offset="55%" stop-color="#A8CEDF"/><stop offset="100%" stop-color="#D6ECF6"/></linearGradient>
    <linearGradient id="fw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3A8040"/><stop offset="100%" stop-color="#256030"/></linearGradient>
    <linearGradient id="rough" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2A5A20"/><stop offset="100%" stop-color="#1E4218"/></linearGradient>
    <linearGradient id="grn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E8040"/><stop offset="100%" stop-color="#156030"/></linearGradient>
    <filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.28)"/></filter>
  </defs>
  <rect width="720" height="215" fill="url(#sky)"/>
  <ellipse cx="110" cy="55" rx="72" ry="25" fill="rgba(255,255,255,0.75)"/>
  <ellipse cx="150" cy="42" rx="50" ry="20" fill="rgba(255,255,255,0.80)"/>
  <ellipse cx="590" cy="60" rx="65" ry="24" fill="rgba(255,255,255,0.62)"/>
  <rect y="210" width="720" height="230" fill="url(#rough)"/>
  <path d="M140,440 L580,440 L475,215 L245,215Z" fill="url(#fw)"/>
  <rect y="208" width="720" height="6" fill="#1E4820" opacity="0.7"/>
  ${elements}
  <rect x="40" y="10" width="250" height="${panelH}" rx="10" fill="white" opacity="0.9" filter="url(#sh)"/>
  <text x="165" y="37" text-anchor="middle" fill="#1a6b3a" font-size="18" font-weight="bold">コース情報</text>
  <line x1="50" y1="47" x2="280" y2="47" stroke="#ddd" stroke-width="1"/>
  ${panel}
</svg>`;
}

function wineSvg(rows: InfoRow[], sceneType: "restaurant" | "shop" | "tasting"): string {
  const panel = rows
    .map(
      (r, i) =>
        `<text x="58" y="${74 + i * 28}" fill="#555" font-size="15">${r.icon} ${r.label}</text>
  <text x="278" y="${74 + i * 28}" text-anchor="end" fill="${r.color}" font-size="16" font-weight="bold">${r.value}</text>`
    )
    .join("\n  ");
  const panelH = 50 + rows.length * 28;
  const bg =
    sceneType === "restaurant"
      ? `<rect width="720" height="440" fill="#1a1520"/>
  <rect x="0" y="340" width="720" height="100" fill="#2a1f30"/>
  <rect x="180" y="180" width="360" height="200" rx="8" fill="#3a2a20" opacity="0.7"/>
  <ellipse cx="280" cy="260" rx="40" ry="8" fill="#fff" opacity="0.08"/>
  <ellipse cx="440" cy="260" rx="40" ry="8" fill="#fff" opacity="0.08"/>
  <rect x="260" y="200" width="8" height="60" rx="2" fill="#c0a060" opacity="0.5"/>
  <circle cx="264" cy="195" r="6" fill="#ff9933" opacity="0.6"/>
  <rect x="440" y="200" width="8" height="60" rx="2" fill="#c0a060" opacity="0.5"/>
  <circle cx="444" cy="195" r="6" fill="#ff9933" opacity="0.6"/>
  <text x="360" y="420" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="13">Restaurant</text>`
      : sceneType === "shop"
        ? `<rect width="720" height="440" fill="#f5f0e8"/>
  <rect x="60" y="80" width="600" height="300" rx="8" fill="#e8ddd0"/>
  <g fill="#8b0000" opacity="0.3"><rect x="100" y="120" width="30" height="120" rx="4"/><rect x="150" y="140" width="30" height="100" rx="4"/><rect x="200" y="110" width="30" height="130" rx="4"/><rect x="250" y="130" width="30" height="110" rx="4"/><rect x="300" y="120" width="30" height="120" rx="4"/><rect x="480" y="130" width="30" height="110" rx="4"/><rect x="530" y="110" width="30" height="130" rx="4"/><rect x="580" y="140" width="30" height="100" rx="4"/></g>
  <rect x="370" y="100" width="3" height="260" fill="#ccc"/>
  <text x="220" y="360" text-anchor="middle" fill="#8b4513" font-size="13" opacity="0.5">赤ワイン</text>
  <text x="500" y="360" text-anchor="middle" fill="#8b4513" font-size="13" opacity="0.5">白ワイン</text>`
        : `<rect width="720" height="440" fill="#f8f4f0"/>
  <rect x="120" y="140" width="480" height="240" rx="12" fill="#fff" stroke="#ddd"/>
  <ellipse cx="260" cy="280" rx="50" ry="10" fill="#eee"/>
  <path d="M250,200 Q260,260 270,200" stroke="#ddd" fill="none" stroke-width="2"/>
  <ellipse cx="260" cy="200" rx="30" ry="6" fill="none" stroke="#ddd" stroke-width="2"/>
  <ellipse cx="260" cy="200" rx="28" ry="5" fill="#8b0000" opacity="0.15"/>
  <ellipse cx="460" cy="280" rx="50" ry="10" fill="#eee"/>
  <path d="M450,200 Q460,260 470,200" stroke="#ddd" fill="none" stroke-width="2"/>
  <ellipse cx="460" cy="200" rx="30" ry="6" fill="none" stroke="#ddd" stroke-width="2"/>
  <ellipse cx="460" cy="200" rx="28" ry="5" fill="#f0e68c" opacity="0.25"/>
  <text x="360" y="400" text-anchor="middle" fill="#999" font-size="13">Tasting</text>`;
  return `<svg width="100%" height="500" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans JP',Arial,sans-serif">
  <defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.28)"/></filter></defs>
  ${bg}
  <rect x="40" y="10" width="250" height="${panelH}" rx="10" fill="white" opacity="0.92" filter="url(#sh)"/>
  <text x="165" y="37" text-anchor="middle" fill="#722F37" font-size="18" font-weight="bold">場面情報</text>
  <line x1="50" y1="47" x2="280" y2="47" stroke="#ddd" stroke-width="1"/>
  ${panel}
</svg>`;
}

function fishingSvg(rows: InfoRow[], sceneType: "sea" | "river" | "lake"): string {
  const panel = rows
    .map(
      (r, i) =>
        `<text x="58" y="${74 + i * 28}" fill="#555" font-size="15">${r.icon} ${r.label}</text>
  <text x="278" y="${74 + i * 28}" text-anchor="end" fill="${r.color}" font-size="16" font-weight="bold">${r.value}</text>`
    )
    .join("\n  ");
  const panelH = 50 + rows.length * 28;
  const bg =
    sceneType === "sea"
      ? `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87CEEB"/><stop offset="40%" stop-color="#4A90D9"/><stop offset="100%" stop-color="#1a4f8a"/></linearGradient>
  <rect width="720" height="440" fill="url(#sea)"/>
  <rect y="260" width="720" height="180" fill="#2e6fb0" opacity="0.5"/>
  <ellipse cx="200" cy="280" rx="120" ry="5" fill="rgba(255,255,255,0.15)"/>
  <ellipse cx="500" cy="310" rx="100" ry="4" fill="rgba(255,255,255,0.12)"/>
  <rect x="50" y="250" width="620" height="12" rx="4" fill="#8B8682" opacity="0.6"/>
  <text x="360" y="420" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="13">堤防</text>`
      : sceneType === "river"
        ? `<linearGradient id="riv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87CEEB"/><stop offset="35%" stop-color="#90c060"/><stop offset="100%" stop-color="#5a8030"/></linearGradient>
  <rect width="720" height="440" fill="url(#riv)"/>
  <path d="M0,250 Q180,220 360,260 Q540,300 720,270 L720,440 L0,440Z" fill="#4A90D9" opacity="0.7"/>
  <ellipse cx="300" cy="320" rx="80" ry="4" fill="rgba(255,255,255,0.15)"/>
  <ellipse cx="500" cy="350" rx="60" ry="3" fill="rgba(255,255,255,0.12)"/>
  <g fill="#2A5A20" opacity="0.5"><ellipse cx="50" cy="230" rx="50" ry="30"/><ellipse cx="680" cy="240" rx="40" ry="25"/></g>`
        : `<linearGradient id="lk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87CEEB"/><stop offset="30%" stop-color="#5aab30"/><stop offset="100%" stop-color="#3a8040"/></linearGradient>
  <rect width="720" height="440" fill="url(#lk)"/>
  <ellipse cx="360" cy="300" rx="280" ry="100" fill="#4A90D9" opacity="0.6"/>
  <ellipse cx="360" cy="290" rx="250" ry="80" fill="#5AA8E0" opacity="0.3"/>
  <text x="360" y="420" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="13">管理釣り場</text>`;
  return `<svg width="100%" height="500" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans JP',Arial,sans-serif">
  <defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.28)"/></filter>${bg}</defs>
  <rect x="40" y="10" width="250" height="${panelH}" rx="10" fill="white" opacity="0.92" filter="url(#sh)"/>
  <text x="165" y="37" text-anchor="middle" fill="#1a4f8a" font-size="18" font-weight="bold">場面情報</text>
  <line x1="50" y1="47" x2="280" y2="47" stroke="#ddd" stroke-width="1"/>
  ${panel}
</svg>`;
}

function entertainmentSvg(rows: InfoRow[]): string {
  const panel = rows
    .map(
      (r, i) =>
        `<text x="58" y="${74 + i * 28}" fill="#555" font-size="15">${r.icon} ${r.label}</text>
  <text x="278" y="${74 + i * 28}" text-anchor="end" fill="${r.color}" font-size="16" font-weight="bold">${r.value}</text>`
    )
    .join("\n  ");
  const panelH = 50 + rows.length * 28;
  return `<svg width="100%" height="500" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans JP',Arial,sans-serif">
  <defs><filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.28)"/></filter></defs>
  <rect width="720" height="440" fill="#1a1520"/>
  <rect y="350" width="720" height="90" fill="#2a1f30"/>
  <rect x="100" y="140" width="520" height="200" rx="12" fill="#3a2a20" opacity="0.6"/>
  <rect x="130" y="170" width="460" height="4" rx="2" fill="#5a4a3a"/>
  <g opacity="0.4">
    <ellipse cx="220" cy="250" rx="35" ry="7" fill="#fff"/>
    <ellipse cx="360" cy="250" rx="35" ry="7" fill="#fff"/>
    <ellipse cx="500" cy="250" rx="35" ry="7" fill="#fff"/>
  </g>
  <rect x="200" y="190" width="8" height="50" rx="2" fill="#c0a060" opacity="0.5"/>
  <circle cx="204" cy="186" r="5" fill="#ff9933" opacity="0.5"/>
  <rect x="500" y="190" width="8" height="50" rx="2" fill="#c0a060" opacity="0.5"/>
  <circle cx="504" cy="186" r="5" fill="#ff9933" opacity="0.5"/>
  <rect x="40" y="10" width="250" height="${panelH}" rx="10" fill="white" opacity="0.92" filter="url(#sh)"/>
  <text x="165" y="37" text-anchor="middle" fill="#8B4513" font-size="18" font-weight="bold">場面情報</text>
  <line x1="50" y1="47" x2="280" y2="47" stroke="#ddd" stroke-width="1"/>
  ${panel}
</svg>`;
}

// =====================================================
// 全39場面のSVGデータ
// =====================================================

// --- ゴルフ ---
// 場面1, 2はpage.tsxにインラインで定義済み（既存SVG）

const GOLF_BEGINNER_3 = golfSvg(
  [
    { icon: "📏", label: "距離", value: "8m", color: "#e63946" },
    { icon: "⛳", label: "パット", value: "上り", color: "#2e8b57" },
    { icon: "↗️", label: "傾斜", value: "右に切れる", color: "#2E6FB0" },
    { icon: "🎯", label: "目標", value: "2パット", color: "#333" },
  ],
  `<ellipse cx="360" cy="220" rx="160" ry="120" fill="url(#grn)" filter="url(#sh)"/>
  <ellipse cx="360" cy="220" rx="160" ry="120" fill="none" stroke="#a8e6cf" stroke-width="2" opacity="0.5"/>
  <line x1="420" y1="140" x2="420" y2="180" stroke="#C0C0C0" stroke-width="2.5"/>
  <polygon points="420,140 445,148 420,156" fill="#CC2200"/>
  <ellipse cx="420" cy="182" rx="6" ry="3" fill="rgba(0,0,0,0.2)"/>
  <circle cx="300" cy="310" r="9" fill="white" stroke="#ccc" stroke-width="1.5"/>
  <path d="M300,310 Q340,280 380,250 Q400,230 420,185" stroke="#e63946" stroke-width="2" stroke-dasharray="6,4" fill="none"/>
  <text x="350" y="268" fill="#e63946" font-size="15" font-weight="bold">8m</text>
  <text x="480" y="180" fill="rgba(255,255,255,0.6)" font-size="12">右に切れる→</text>`
);

const GOLF_MID_1 = golfSvg(
  [
    { icon: "📏", label: "残り", value: "110Y", color: "#e63946" },
    { icon: "⛰️", label: "ライ", value: "左足下がり", color: "#8B4513" },
    { icon: "📍", label: "ピン", value: "奥右", color: "#2e8b57" },
    { icon: "💨", label: "風", value: "アゲンスト1C", color: "#2E6FB0" },
  ],
  `<ellipse cx="380" cy="200" rx="70" ry="28" fill="url(#grn)" filter="url(#sh)"/>
  <line x1="400" y1="175" x2="400" y2="200" stroke="#C0C0C0" stroke-width="2"/>
  <polygon points="400,175 418,180 400,185" fill="#CC2200"/>
  <circle cx="360" cy="360" r="8" fill="white" stroke="#ccc" stroke-width="1.5"/>
  <path d="M360,360 L390,205" stroke="#90EE90" stroke-width="2" stroke-dasharray="8,5" opacity="0.8"/>
  <text x="395" y="290" fill="rgba(255,255,255,0.7)" font-size="13" font-weight="bold">110Y</text>
  <text x="450" y="370" fill="rgba(255,255,255,0.4)" font-size="11">← 左足下がり</text>`
);

const GOLF_MID_2 = golfSvg(
  [
    { icon: "⛳", label: "パー", value: "4", color: "#333" },
    { icon: "📏", label: "距離", value: "400Y", color: "#e63946" },
    { icon: "↪️", label: "形状", value: "右ドッグレッグ", color: "#8B4513" },
    { icon: "⚠️", label: "注意", value: "先にバンカー？", color: "#b89840" },
  ],
  `<path d="M300,440 Q320,300 420,250 Q520,200 550,180" stroke="url(#fw)" stroke-width="80" fill="none" opacity="0.8"/>
  <ellipse cx="420" cy="200" rx="50" ry="20" fill="url(#grn)" filter="url(#sh)"/>
  <line x1="420" y1="180" x2="420" y2="200" stroke="#C0C0C0" stroke-width="2"/>
  <polygon points="420,180 435,184 420,188" fill="#CC2200"/>
  <rect x="460" y="220" width="80" height="24" rx="5" fill="rgba(0,0,0,0.5)"/>
  <text x="500" y="237" text-anchor="middle" fill="#ffcc00" font-size="11" font-weight="bold">バンカー？</text>
  <circle cx="300" cy="410" r="8" fill="white" stroke="#ccc" stroke-width="1.5"/>
  <text x="320" y="430" fill="rgba(255,255,255,0.5)" font-size="10">ティー</text>`
);

const GOLF_MID_3 = golfSvg(
  [
    { icon: "📏", label: "エッジから", value: "5Y", color: "#333" },
    { icon: "📍", label: "ピンまで", value: "20Y", color: "#e63946" },
    { icon: "⬇️", label: "奥", value: "下り傾斜", color: "#2E6FB0" },
  ],
  `<ellipse cx="380" cy="220" rx="140" ry="110" fill="url(#grn)" filter="url(#sh)"/>
  <ellipse cx="380" cy="220" rx="140" ry="110" fill="none" stroke="#a8e6cf" stroke-width="2" opacity="0.5"/>
  <line x1="420" y1="160" x2="420" y2="195" stroke="#C0C0C0" stroke-width="2"/>
  <polygon points="420,160 438,166 420,172" fill="#CC2200"/>
  <circle cx="280" cy="330" r="8" fill="white" stroke="#ccc" stroke-width="1.5"/>
  <text x="250" y="350" fill="#333" font-size="11" font-weight="bold">ボール</text>
  <path d="M280,330 L415,200" stroke="#e63946" stroke-width="2" stroke-dasharray="6,4" fill="none"/>
  <text x="340" y="260" fill="#e63946" font-size="14" font-weight="bold">20Y</text>
  <text x="460" y="150" fill="rgba(255,255,255,0.5)" font-size="11">奥は下り↓</text>`
);

const GOLF_ADV_1 = golfSvg(
  [
    { icon: "⛳", label: "パー", value: "5", color: "#333" },
    { icon: "📏", label: "残り", value: "230Y", color: "#e63946" },
    { icon: "⚠️", label: "手前", value: "バンカー", color: "#b89840" },
    { icon: "📊", label: "スコア", value: "イーブン", color: "#2e8b57" },
    { icon: "💨", label: "風", value: "ほぼ無風", color: "#2E6FB0" },
  ],
  `<ellipse cx="380" cy="200" rx="70" ry="28" fill="url(#grn)" filter="url(#sh)"/>
  <line x1="380" y1="175" x2="380" y2="200" stroke="#C0C0C0" stroke-width="2"/>
  <polygon points="380,175 398,180 380,185" fill="#CC2200"/>
  <ellipse cx="380" cy="260" rx="50" ry="20" fill="#e8d5a0" opacity="0.7"/>
  <text x="380" y="265" text-anchor="middle" fill="#8b7340" font-size="10">バンカー</text>
  <circle cx="360" cy="390" r="8" fill="white" stroke="#ccc" stroke-width="1.5"/>
  <path d="M360,390 L378,205" stroke="#90EE90" stroke-width="2" stroke-dasharray="8,5" opacity="0.8"/>
  <text x="390" y="310" fill="rgba(255,255,255,0.7)" font-size="14" font-weight="bold">230Y</text>`
);

const GOLF_ADV_2 = golfSvg(
  [
    { icon: "📏", label: "残り", value: "150Y", color: "#e63946" },
    { icon: "⛰️", label: "打ち上げ", value: "10Y分", color: "#8B4513" },
    { icon: "💨", label: "風", value: "フォロー1C", color: "#2E6FB0" },
    { icon: "📍", label: "ピン", value: "グリーン左端", color: "#2e8b57" },
  ],
  `<ellipse cx="380" cy="200" rx="80" ry="30" fill="url(#grn)" filter="url(#sh)"/>
  <line x1="340" y1="180" x2="340" y2="200" stroke="#C0C0C0" stroke-width="2"/>
  <polygon points="340,180 358,185 340,190" fill="#CC2200"/>
  <text x="320" y="175" fill="rgba(255,255,255,0.5)" font-size="10">ピン左端</text>
  <circle cx="370" cy="380" r="8" fill="white" stroke="#ccc" stroke-width="1.5"/>
  <path d="M370,380 L345,205" stroke="#90EE90" stroke-width="2" stroke-dasharray="8,5" opacity="0.8"/>
  <text x="380" y="300" fill="rgba(255,255,255,0.7)" font-size="14" font-weight="bold">150Y</text>
  <text x="500" y="350" fill="rgba(255,255,255,0.3)" font-size="11">↑ 打ち上げ10Y</text>`
);

const GOLF_ADV_3 = golfSvg(
  [
    { icon: "🏁", label: "現在", value: "15番終了", color: "#333" },
    { icon: "📊", label: "ペース", value: "自己ベスト", color: "#e63946" },
    { icon: "⚠️", label: "次", value: "16番（難ホール）", color: "#b89840" },
    { icon: "🧠", label: "テーマ", value: "マインドセット", color: "#2e8b57" },
  ],
  `<ellipse cx="380" cy="220" rx="80" ry="30" fill="url(#grn)" filter="url(#sh)"/>
  <line x1="380" y1="195" x2="380" y2="220" stroke="#C0C0C0" stroke-width="2"/>
  <polygon points="380,195 398,200 380,205" fill="#CC2200"/>
  <rect x="320" y="290" width="120" height="36" rx="8" fill="rgba(200,50,0,0.6)"/>
  <text x="380" y="313" text-anchor="middle" fill="white" font-size="13" font-weight="bold">16番 難ホール</text>
  <rect x="320" y="370" width="120" height="30" rx="8" fill="rgba(30,100,60,0.6)"/>
  <text x="380" y="390" text-anchor="middle" fill="white" font-size="12" font-weight="bold">自己ベストペース</text>`
);

// --- ワイン ---
const WINE_CASUAL_1 = wineSvg(
  [
    { icon: "🎉", label: "場面", value: "パーティー手土産", color: "#722F37" },
    { icon: "💰", label: "予算", value: "3,000円", color: "#e63946" },
    { icon: "🍽️", label: "料理", value: "洋食全般", color: "#8B4513" },
  ],
  "shop"
);
const WINE_CASUAL_2 = wineSvg(
  [
    { icon: "🍽️", label: "場面", value: "レストラン", color: "#722F37" },
    { icon: "❓", label: "質問", value: "赤 or 白？", color: "#e63946" },
    { icon: "🥩", label: "メイン", value: "和牛ステーキ", color: "#8B4513" },
  ],
  "restaurant"
);
const WINE_CASUAL_3 = wineSvg(
  [
    { icon: "🎁", label: "場面", value: "上司への手土産", color: "#722F37" },
    { icon: "💰", label: "予算", value: "5,000円", color: "#e63946" },
    { icon: "❓", label: "好み", value: "不明", color: "#999" },
  ],
  "shop"
);
const WINE_MONTHLY_1 = wineSvg(
  [
    { icon: "🍽️", label: "場面", value: "接待フレンチ", color: "#722F37" },
    { icon: "👤", label: "相手", value: "60代役員", color: "#333" },
    { icon: "🐟", label: "コース", value: "魚介中心", color: "#2E6FB0" },
  ],
  "restaurant"
);
const WINE_MONTHLY_2 = wineSvg(
  [
    { icon: "📋", label: "場面", value: "知らない銘柄ばかり", color: "#722F37" },
    { icon: "💰", label: "予算", value: "1人5,000円", color: "#e63946" },
    { icon: "❓", label: "手がかり", value: "何を基準に？", color: "#999" },
  ],
  "restaurant"
);
const WINE_MONTHLY_3 = wineSvg(
  [
    { icon: "🎂", label: "場面", value: "誕生日プレゼント", color: "#722F37" },
    { icon: "👤", label: "相手", value: "ワイン好き", color: "#8B4513" },
    { icon: "💰", label: "予算", value: "10,000円", color: "#e63946" },
  ],
  "shop"
);
const WINE_BIZ_1 = wineSvg(
  [
    { icon: "🍽️", label: "場面", value: "「お任せします」", color: "#722F37" },
    { icon: "💰", label: "予算", value: "1本3万円まで", color: "#e63946" },
    { icon: "🍴", label: "料理", value: "フレンチコース", color: "#8B4513" },
  ],
  "restaurant"
);
const WINE_BIZ_2 = wineSvg(
  [
    { icon: "🍷", label: "選択", value: "ボルドー vs ブルゴーニュ", color: "#722F37" },
    { icon: "🌙", label: "条件", value: "今夜1本だけ", color: "#333" },
  ],
  "restaurant"
);
const WINE_BIZ_3 = wineSvg(
  [
    { icon: "📅", label: "保管", value: "10年後まで", color: "#722F37" },
    { icon: "🎯", label: "目的", value: "自飲み用", color: "#333" },
    { icon: "❌", label: "注意", value: "投資ではない", color: "#999" },
  ],
  "shop"
);
const WINE_SERIOUS_1 = wineSvg(
  [
    { icon: "🍷", label: "場面", value: "テイスティング", color: "#722F37" },
    { icon: "❓", label: "質問", value: "最初に確認は？", color: "#e63946" },
  ],
  "tasting"
);
const WINE_SERIOUS_2 = wineSvg(
  [
    { icon: "📊", label: "テーマ", value: "優先基準", color: "#722F37" },
    { icon: "🏷️", label: "比較", value: "ヴィンテージ vs 生産者", color: "#333" },
  ],
  "tasting"
);
const WINE_SERIOUS_3 = wineSvg(
  [
    { icon: "🌍", label: "テーマ", value: "産地別の選び方", color: "#722F37" },
    { icon: "❓", label: "質問", value: "軸は変わる？", color: "#e63946" },
  ],
  "tasting"
);

// --- 釣り ---
const FISH_CASUAL_1 = fishingSvg(
  [
    { icon: "📍", label: "選択肢", value: "海・川・管理釣り場", color: "#1a4f8a" },
    { icon: "📅", label: "日程", value: "週末", color: "#333" },
    { icon: "❓", label: "質問", value: "どこに行く？", color: "#e63946" },
  ],
  "sea"
);
const FISH_CASUAL_2 = fishingSvg(
  [
    { icon: "📍", label: "場所", value: "初めての釣り場", color: "#1a4f8a" },
    { icon: "👥", label: "周囲", value: "他に釣り人あり", color: "#333" },
    { icon: "❓", label: "質問", value: "まず何を確認？", color: "#e63946" },
  ],
  "sea"
);
const FISH_CASUAL_3 = fishingSvg(
  [
    { icon: "⏱️", label: "経過", value: "1時間", color: "#333" },
    { icon: "🎣", label: "釣果", value: "ゼロ", color: "#e63946" },
    { icon: "👥", label: "周囲", value: "同様に釣れず", color: "#999" },
    { icon: "❓", label: "質問", value: "何を変える？", color: "#e63946" },
  ],
  "sea"
);
const FISH_MONTHLY_1 = fishingSvg(
  [
    { icon: "⏱️", label: "経過", value: "朝6時から2時間", color: "#333" },
    { icon: "🎣", label: "釣果", value: "ゼロ", color: "#e63946" },
    { icon: "👤", label: "隣の人", value: "釣れている", color: "#2e8b57" },
  ],
  "river"
);
const FISH_MONTHLY_2 = fishingSvg(
  [
    { icon: "🌧️", label: "天気", value: "午後から崩れる", color: "#2E6FB0" },
    { icon: "🎣", label: "釣果", value: "まだゼロ", color: "#e63946" },
    { icon: "❓", label: "質問", value: "どうする？", color: "#e63946" },
  ],
  "river"
);
const FISH_MONTHLY_3 = fishingSvg(
  [
    { icon: "🌊", label: "状況", value: "川に濁りあり", color: "#8B4513" },
    { icon: "🎣", label: "釣果", value: "まずまず", color: "#2e8b57" },
    { icon: "❓", label: "質問", value: "ルアーをどう変える？", color: "#e63946" },
  ],
  "river"
);
const FISH_SERIOUS_1 = fishingSvg(
  [
    { icon: "🐟", label: "ターゲット", value: "シーバス", color: "#1a4f8a" },
    { icon: "🌊", label: "潮", value: "上げ→下げ変化点", color: "#2E6FB0" },
    { icon: "🐠", label: "ベイト", value: "表層にいる", color: "#2e8b57" },
  ],
  "sea"
);
const FISH_SERIOUS_2 = fishingSvg(
  [
    { icon: "📍", label: "場所", value: "お気に入りポイント", color: "#1a4f8a" },
    { icon: "⏱️", label: "経過", value: "2時間反応なし", color: "#e63946" },
    { icon: "❓", label: "質問", value: "どうする？", color: "#e63946" },
  ],
  "sea"
);
const FISH_SERIOUS_3 = fishingSvg(
  [
    { icon: "🐟", label: "状況", value: "ライズあり", color: "#2e8b57" },
    { icon: "🎣", label: "バイト", value: "なし（数投済み）", color: "#e63946" },
    { icon: "❓", label: "質問", value: "アプローチ変更？", color: "#e63946" },
  ],
  "sea"
);

// --- 接待会食 ---
const ENT_ANNUAL_1 = entertainmentSvg([
  { icon: "📋", label: "場面", value: "初めての接待", color: "#8B4513" },
  { icon: "💰", label: "予算", value: "1人1万円", color: "#e63946" },
  { icon: "👥", label: "相手", value: "担当者2名", color: "#333" },
  { icon: "❓", label: "質問", value: "まず何を確認？", color: "#e63946" },
]);
const ENT_ANNUAL_2 = entertainmentSvg([
  { icon: "⏱️", label: "経過", value: "30分", color: "#333" },
  { icon: "😶", label: "状況", value: "相手が話さない", color: "#e63946" },
  { icon: "🍽️", label: "料理", value: "提供済み", color: "#2e8b57" },
]);
const ENT_ANNUAL_3 = entertainmentSvg([
  { icon: "🕘", label: "時刻", value: "21時", color: "#333" },
  { icon: "🍺", label: "雰囲気", value: "飲み足りなさそう", color: "#e63946" },
  { icon: "❓", label: "質問", value: "2次会どうする？", color: "#e63946" },
]);
const ENT_MONTHLY_1 = entertainmentSvg([
  { icon: "📋", label: "翌日", value: "大型案件の提案", color: "#e63946" },
  { icon: "👥", label: "相手", value: "先方役員2名", color: "#333" },
  { icon: "🤝", label: "関係", value: "まだ浅い", color: "#999" },
  { icon: "❓", label: "質問", value: "どんな店を？", color: "#e63946" },
]);
const ENT_MONTHLY_2 = entertainmentSvg([
  { icon: "⏱️", label: "タイミング", value: "中盤・場が温まる", color: "#333" },
  { icon: "💬", label: "状況", value: "愚痴を話し始めた", color: "#e63946" },
  { icon: "❓", label: "質問", value: "どう対応？", color: "#e63946" },
]);
const ENT_MONTHLY_3 = entertainmentSvg([
  { icon: "🍽️", label: "場所", value: "予約した個室", color: "#8B4513" },
  { icon: "⏱️", label: "問題", value: "料理30分来ない", color: "#e63946" },
  { icon: "⚠️", label: "原因", value: "オーダー未通", color: "#e63946" },
]);
const ENT_FREQUENT_1 = entertainmentSvg([
  { icon: "📋", label: "状況", value: "商談前・場は盛況", color: "#333" },
  { icon: "🍺", label: "相手", value: "酔ってきた", color: "#e63946" },
  { icon: "❓", label: "質問", value: "どうする？", color: "#e63946" },
]);
const ENT_FREQUENT_2 = entertainmentSvg([
  { icon: "⏱️", label: "タイミング", value: "中盤", color: "#333" },
  { icon: "💬", label: "発言", value: "「競合と話してる」", color: "#e63946" },
  { icon: "❓", label: "質問", value: "どう対応？", color: "#e63946" },
]);
const ENT_FREQUENT_3 = entertainmentSvg([
  { icon: "📅", label: "時期", value: "翌日", color: "#333" },
  { icon: "💬", label: "先方", value: "「楽しかった」", color: "#2e8b57" },
  { icon: "❓", label: "質問", value: "フォローは？", color: "#e63946" },
]);

// =====================================================
// トピック×レベル×場面 → SVG のマッピング
// =====================================================
export const SCENE_SVGS: Record<string, Record<string, [string, string, string]>> = {
  golf: {
    "初心者（スコア100以上）": [
      "", // 場面1はpage.tsxにインライン定義（既存）
      "", // 場面2もpage.tsxにインライン定義（既存）
      GOLF_BEGINNER_3,
    ],
    "中級者（スコア85〜100）": [GOLF_MID_1, GOLF_MID_2, GOLF_MID_3],
    "上級者（スコア85以下）": [GOLF_ADV_1, GOLF_ADV_2, GOLF_ADV_3],
  },
  wine: {
    "たまに飲む程度": ["", "", ""],  // 選択肢テキストで表示、SVG不要
    "月に数回自分で選ぶ": [WINE_MONTHLY_1, WINE_MONTHLY_2, WINE_MONTHLY_3],
    "接待等でよく選ぶ": [WINE_BIZ_1, WINE_BIZ_2, WINE_BIZ_3],
    "本格的に学んでいる": [WINE_SERIOUS_1, WINE_SERIOUS_2, WINE_SERIOUS_3],
  },
  fishing: {
    "たまにやる程度（海釣り・川釣り）": [FISH_CASUAL_1, FISH_CASUAL_2, FISH_CASUAL_3],
    "月に数回楽しむ": [FISH_MONTHLY_1, FISH_MONTHLY_2, FISH_MONTHLY_3],
    "本格的にやっている（ルアー・フライ・磯など）": [FISH_SERIOUS_1, FISH_SERIOUS_2, FISH_SERIOUS_3],
  },
  entertainment: {
    "年に数回程度": [ENT_ANNUAL_1, ENT_ANNUAL_2, ENT_ANNUAL_3],
    "月に1〜2回": [ENT_MONTHLY_1, ENT_MONTHLY_2, ENT_MONTHLY_3],
    "月に3回以上（接待が日常業務の一部）": [ENT_FREQUENT_1, ENT_FREQUENT_2, ENT_FREQUENT_3],
  },
};

// トピックIDを判定するヘルパー
export function getTopicId(topic: string): string | null {
  if (topic.includes("ゴルフ")) return "golf";
  if (topic.includes("ワイン")) return "wine";
  if (topic.includes("釣り")) return "fishing";
  if (topic.includes("接待")) return "entertainment";
  return null;
}

// レベルラベルを抽出するヘルパー
export function getLevelLabel(topic: string): string | null {
  const match = topic.match(/\/ (.+)）$/);
  return match ? match[1] : null;
}

// 場面SVGを取得
export function getSceneSvgFromMap(
  topic: string,
  sceneIndex: number
): string | null {
  const topicId = getTopicId(topic);
  if (!topicId) return null;
  const level = getLevelLabel(topic);
  if (!level) return null;
  const scenes = SCENE_SVGS[topicId]?.[level];
  if (!scenes || sceneIndex >= scenes.length) return null;
  const svg = scenes[sceneIndex];
  return svg || null; // 空文字はnull（page.tsxのインライン定義を使う）
}
