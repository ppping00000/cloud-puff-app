'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================
   Cloud Puff ☁️ — Web 單檔元件版（第二十四版）
   直接把這個檔案放到 Next.js 專案的 app/page.tsx（或任一 page）
   即可部署到 Vercel。全部邏輯、樣式、假資料都包在同一個檔案裡，
   使用 styled-jsx（Next.js 內建，免安裝）做動畫與樣式。

   本版變更：
   22. 小遊戲「我是好寶寶」的藍色桶子換成菸灰缸（AshtrayIcon）。
   23. 地上可以點的魔法棒 emoji 換成菸蒂（CigaretteButtIcon），
       每根都有隨機傾斜角度，看起來像真的散落在地上。
   兩個圖示都是直接用 SVG 畫在這個檔案裡，不需要上傳任何圖片檔。

   （其餘功能同上一版，詳見各段落內的中文註解）
   ============================================================ */

/* ---------------------- 型別 ---------------------- */

type CharacterType = 'panda' | 'cat' | 'fox' | 'rabbit';
type OnlineStatus = 'online' | 'offline' | 'in_room';
type CharacterState = 'idle' | 'inhale' | 'exhale' | 'relaxed';
type ScreenName = 'home' | 'puffroom' | 'result' | 'stats' | 'shop' | 'friend' | 'backpack' | 'goodkid' | 'leaderboard' | 'notifications';

interface UserData {
  id: string;
  nickname: string;
  avatarCharacter: CharacterType;
  level: number;
  exp: number;
  expToNextLevel: number;
  title: string;
  onlineStatus: OnlineStatus;
  equippedSkin: string;
}

interface SkinData {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  quantity: number; // 背包裡目前擁有幾隻（開抽一次會少一隻）
  price: number; // 商城售價（目前全面 0 元），買一次會拿到 20 隻
  handleColor: string; // 握把顏色
  handleStroke: string; // 握把邊框顏色
  bodyFill: string; // 棒身顏色
  bodyStroke: string; // 棒身邊框顏色
  tipEmoji: string; // 尖端微光符號
  particleEmoji: string; // 吐出來的粒子符號
  particleColor: string; // 粒子顏色（給非彩色符號用，emoji 本身通常固定色）
}

interface RestHistoryItem {
  date: string;
  withWho: string;
  duration: string;
}

interface UserStats {
  totalRestCount: number;
  // 被別人用「免費菸」請過幾次（累積二手菸）。跟自己抽的次數完全分開算，
  // 不影響肺部黑化、等級、今日／本月次數。
  secondhandCount?: number;
  history: RestHistoryItem[];
  // 每次「開抽」當下的完整時間戳記（ISO 格式），今日/本月次數都是即時從這份清單算出來的，
  // 不再用會忘記歸零的累加計數器。只保留最近一段時間的紀錄就夠算今日/本月了。
  puffTimestamps?: string[];
}

// 通知：目前有五種
// 'stolen' = 呼吸小偷偷了你（from=小偷暱稱, amount=偷了幾隻呼吸棒）
// 'friend_puffing' = 你有加的好友開始抽了（from=好友暱稱）
// 'robbed' = 有人用呼吸券搶走你的錢（from=搶匪暱稱, amount=搶走幾元）
// 'force_puffed' = 有朋友請你抽一支（from=朋友暱稱），你的累積二手菸會 +1
interface NotificationEntry {
  kind: 'stolen' | 'friend_puffing' | 'robbed' | 'force_puffed';
  from: string;
  amount?: number;
  date: string;
  read?: boolean;
}

/* ---------------------- 設計系統 Tokens ---------------------- */

const colors = {
  cloudWhite: '#FFFFFF',
  skyBlue: '#87CEEB',
  lavender: '#B8A6FF',
  milkTea: '#E8D5B7',
  softPink: '#FFD6E7',
  mintGreen: '#CFF4D2',
  textPrimary: '#4A4A5A',
  textSecondary: '#8A8A9A',
  textOnColor: '#FFFFFF',
  online: '#7FD8C8',
  offline: '#C9C9D4',
  background: '#FBFBFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F1FF',
  danger: '#FF6B6B',
};

const radius = { input: 16, card: 24, modal: 28, pill: 999 };
const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };
const cardShadow = '0 4px 12px rgba(135, 206, 235, 0.15)';
const buttonShadow = '0 6px 16px rgba(184, 166, 255, 0.35)';

const CHARACTER_EMOJI: Record<CharacterType, string> = {
  panda: '🐼',
  cat: '🐱',
  fox: '🦊',
  rabbit: '🐰',
};

/* ---------------------- 等級 / 稱號系統 ----------------------
   依「累積放空次數」（totalRestCount）決定等級與稱號。
   Lv.1~9　每 5 隻升一級
   Lv.10~19　每 10 隻升一級
   Lv.20~29　每 20 隻升一級
   Lv.30~39　每 30 隻升一級
   Lv.40~49　每 50 隻升一級
   Lv.50（封頂）累積 1200 隻
   ---------------------------------------------------------- */

// 每個等級「達成所需的累積隻數」，index 對應等級（1~50）
function buildLevelThresholds(): number[] {
  const thresholds: number[] = new Array(51).fill(0);
  thresholds[1] = 0;
  for (let lvl = 2; lvl <= 9; lvl++) thresholds[lvl] = thresholds[lvl - 1] + 5;
  for (let lvl = 10; lvl <= 19; lvl++) thresholds[lvl] = thresholds[lvl - 1] + 10;
  for (let lvl = 20; lvl <= 29; lvl++) thresholds[lvl] = thresholds[lvl - 1] + 20;
  for (let lvl = 30; lvl <= 39; lvl++) thresholds[lvl] = thresholds[lvl - 1] + 30;
  for (let lvl = 40; lvl <= 49; lvl++) thresholds[lvl] = thresholds[lvl - 1] + 50;
  thresholds[50] = 1200; // 封頂：累積 1200 支
  return thresholds;
}
const LEVEL_THRESHOLDS = buildLevelThresholds();

const LEVEL_TITLE_BRACKETS: { min: number; max: number; title: string; note: string }[] = [
  { min: 1, max: 9, title: '裝B哥', note: '只會擺 Pose 根本沒吸進去' },
  { min: 10, max: 19, title: '寶寶你真的學壞了', note: '自以為很帥笑死' },
  { min: 20, max: 29, title: '現在戒還來得及', note: '寶寶回頭是岸' },
  { min: 30, max: 39, title: '你真的很可憐', note: '肺部已呈炭黑色，沒事就在喘' },
  { min: 40, max: 49, title: '焦油積沉大師', note: '黑人都沒你黑' },
  { min: 50, max: 50, title: '大黑肺之神', note: '我會每年帶幾包去你墳頭燒給你' },
];

interface LevelInfo {
  level: number;
  title: string;
  note: string;
  progress: number; // 0~100，距離下一級的進度；滿級固定 100
}

function computeLevelInfo(totalRestCount: number): LevelInfo {
  let level = 1;
  for (let lvl = 1; lvl <= 50; lvl++) {
    if (totalRestCount >= LEVEL_THRESHOLDS[lvl]) level = lvl;
    else break;
  }
  const bracket = LEVEL_TITLE_BRACKETS.find((b) => level >= b.min && level <= b.max) ?? LEVEL_TITLE_BRACKETS[0];
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const nextThreshold = level < 50 ? LEVEL_THRESHOLDS[level + 1] : null;
  const progress = nextThreshold
    ? Math.max(0, Math.min(100, ((totalRestCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;
  return { level, title: bracket.title, note: bracket.note, progress };
}

/* ---------------------- 共用時間格式 ---------------------- */

// 格式化成「月/日 時:分」，用在歷史紀錄（開抽時間）與通知時間
function formatDateTime(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hh}:${mm}`;
}

// 格式化成「YYYY-MM-DD」，用來判斷「今天」是不是同一天（本地時區）
function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 舊版歷史紀錄只存「M/D HH:MM」（沒有年份），把它還原成完整日期時間，
// 用來把「改版前抽的那些」也正確算進今日/本月。假設是今年；如果算出來的時間
// 比現在晚超過 2 天（代表其實是去年跨年前抽的），就自動退回去年。
function parseLegacyDateLabel(label: string): Date | null {
  const match = label.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, mm, dd, hh, min] = match;
  const now = new Date();
  const guess = new Date(now.getFullYear(), parseInt(mm, 10) - 1, parseInt(dd, 10), parseInt(hh, 10), parseInt(min, 10));
  if (guess.getTime() - now.getTime() > 1000 * 60 * 60 * 24 * 2) {
    guess.setFullYear(guess.getFullYear() - 1);
  }
  return guess;
}

// 從「開抽時間戳記」清單即時算出今日／本月次數（不是存好的累加數字，所以永遠不會忘記歸零）
function computeTodayAndMonthCounts(puffTimestamps: string[]): { today: number; month: number } {
  const now = new Date();
  const todayKey = getDateKey(now);
  const monthKey = todayKey.slice(0, 7);
  let today = 0;
  let month = 0;
  for (const ts of puffTimestamps) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    const key = getDateKey(d);
    if (key === todayKey) today++;
    if (key.slice(0, 7) === monthKey) month++;
  }
  return { today, month };
}

// 一次性搬遷：改版前的帳號沒有 puffTimestamps，用舊的「歷史紀錄」（裡面本來就記著
// 每次開抽的日期時間）反推出過去的時間戳記，這樣改版前抽的也會被正確算進今日/本月。
function migrateStatsToTimeSystem(stats: UserStats): UserStats {
  if (stats.puffTimestamps && stats.puffTimestamps.length > 0) return stats;
  const derived = stats.history
    .map((h) => parseLegacyDateLabel(h.date))
    .filter((d): d is Date => d !== null)
    .map((d) => d.toISOString());
  return { ...stats, puffTimestamps: derived };
}

/* ---------------------- 假資料 ---------------------- */

// 一個「帳號」在雲端共用資料庫裡存的內容：頭像、背包庫存、放空紀錄
// 沒有密碼、沒有登入驗證，純粹用暱稱當 key 做區分（簡易版帳號系統）
interface CommentEntry {
  from: string;
  text: string;
  date: string;
}

interface AccountRecord {
  avatarCharacter: CharacterType;
  quantities: Record<string, number>; // 每款呼吸棒的背包庫存，key 是 skin id
  stats: UserStats;
  friends?: string[]; // 已加的好友暱稱清單
  coins?: number; // 零錢包餘額（元），大家都從 0 元開始
  comments?: CommentEntry[]; // 別人留在這個帳號放空紀錄下面的留言
  tools?: Record<string, number>; // 特殊道具庫存，例如 breathThief（呼吸小偷）
  notifications?: NotificationEntry[]; // 收到的通知：被偷、被搶、好友開抽
  watchers?: string[]; // 有把「我」加為好友的人的暱稱清單，我開抽時要通知這些人
}

const mockSkins: SkinData[] = [
  {
    id: 'milktea_white_stick',
    name: '奶茶白呼吸棒',
    rarity: 'common',
    quantity: 5,
    price: 200,
    handleColor: colors.milkTea,
    handleStroke: '#D8BE95',
    bodyFill: '#FFFFFF',
    bodyStroke: '#E7E4F5',
    tipEmoji: '☁️',
    particleEmoji: '☁️',
    particleColor: '#B8A6FF',
  },
  {
    id: 'pink_stick',
    name: '粉紅呼吸棒',
    rarity: 'rare',
    quantity: 3,
    price: 200,
    handleColor: '#2B2B33',
    handleStroke: '#1A1A20',
    bodyFill: '#FFB6D9',
    bodyStroke: '#FF9FCB',
    tipEmoji: '💗',
    particleEmoji: '💗',
    particleColor: '#FF8FC2',
  },
  {
    id: 'rainbow_stick',
    name: '彩虹呼吸棒',
    rarity: 'epic',
    quantity: 2,
    price: 200,
    handleColor: '#2B2B33',
    handleStroke: '#1A1A20',
    bodyFill: '#FFD6E7',
    bodyStroke: '#B8A6FF',
    tipEmoji: '🌈',
    particleEmoji: '🌈',
    particleColor: '#FFD6E7',
  },
  {
    id: 'aurora_stick',
    name: '極光呼吸棒',
    rarity: 'epic',
    quantity: 0,
    price: 200,
    handleColor: '#2B2B33',
    handleStroke: '#1A1A20',
    bodyFill: '#CFF4D2',
    bodyStroke: '#87CEEB',
    tipEmoji: '✨',
    particleEmoji: '✨',
    particleColor: '#CFF4D2',
  },
  {
    id: 'galaxy_stick',
    name: '星河呼吸棒',
    rarity: 'legendary',
    quantity: 0,
    price: 200,
    handleColor: '#2B2B33',
    handleStroke: '#1A1A20',
    bodyFill: '#87CEEB',
    bodyStroke: '#B8A6FF',
    tipEmoji: '⭐',
    particleEmoji: '⭐',
    particleColor: '#87CEEB',
  },
];

// 全新帳號一開始拿到的背包庫存（起始包）
const STARTER_QUANTITIES: Record<string, number> = Object.fromEntries(mockSkins.map((s) => [s.id, s.quantity]));

// 全新帳號一開始的放空紀錄（都從 0 開始）
const STARTER_STATS: UserStats = {
  totalRestCount: 0,
  secondhandCount: 0,
  history: [],
  puffTimestamps: [],
};

// 全新帳號一開始的零錢包餘額
const STARTER_COINS = 0;

// 商城買一款呼吸棒（20 隻）要花的錢
const SHOP_PRICE = 200;

// 小遊戲「我是好寶寶」：每撿一隻呼吸棒進桶子可以賺多少錢
const GOOD_KID_COIN_PER_STICK = 1;
// 遊戲場地上同時會有幾隻呼吸棒（撿走一隻就會馬上補一隻新的，等於無限生成）
const GOOD_KID_STICK_COUNT = 6;

// 買菸花費：累積休息每滿 SPEND_PER_STICKS 支，就當作花了 SPEND_AMOUNT_PER_UNIT 元買菸
const SPEND_PER_STICKS = 20;
const SPEND_AMOUNT_PER_UNIT = 100;

function computeCigaretteSpending(totalRestCount: number): number {
  return Math.floor(totalRestCount / SPEND_PER_STICKS) * SPEND_AMOUNT_PER_UNIT;
}


// 商城買一個「呼吸小偷」道具要花的錢
const BREATH_THIEF_PRICE = 50;
// 呼吸小偷使用一次，會從朋友背包隨機偷走幾隻呼吸棒（1 ~ 50 隻之間隨機）
const BREATH_THIEF_MIN_STEAL = 1;
const BREATH_THIEF_MAX_STEAL = 50;
// 道具庫存用的 key
const TOOL_BREATH_THIEF = 'breathThief';

// 呼吸券：完整抽完一整隻呼吸棒（燒到 0%）就會拿到一張
// 可以在背包裡使用，去搶朋友的錢，一次搶 100 ~ 200 元之間
const TOOL_BREATH_VOUCHER = 'breathVoucher';
const ROB_MIN_AMOUNT = 100;
const ROB_MAX_AMOUNT = 200;

// 免費菸（免費的給你抽啦）：只要「開抽」就會拿到一張，不用抽完
// 可以在背包或朋友頁使用，硬請朋友抽一支：對方累積放空次數 +1（肺會變黑一點）
const TOOL_FREE_PUFF = 'freePuff';

/* ============================================================
   共用小元件（都定義在同一檔案內，不拆檔）
   ============================================================ */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.card,
        padding: spacing.md,
        boxShadow: cardShadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function AvatarBubble({
  character,
  size = 56,
  status = 'offline',
}: {
  character: CharacterType;
  size?: number;
  status?: OnlineStatus;
}) {
  const isOnline = status !== 'offline';
  const dotColor = isOnline ? colors.online : colors.offline;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: colors.surfaceMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.5,
          opacity: isOnline ? 1 : 0.6,
          border: `2px solid ${isOnline ? colors.lavender : 'transparent'}`,
        }}
      >
        {CHARACTER_EMOJI[character]}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: '50%',
          background: dotColor,
          border: '2px solid #FFFFFF',
        }}
      />
    </div>
  );
}

function ProgressBar({
  progress,
  height = 8,
  fillColor = colors.lavender,
}: {
  progress: number;
  height?: number;
  fillColor?: string;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div
      style={{
        width: '100%',
        height,
        background: colors.surfaceMuted,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: fillColor,
          borderRadius: height / 2,
          transition: 'width 0.3s ease-out',
        }}
      />
    </div>
  );
}

function CloudButton({
  label,
  icon = '☁️',
  onClick,
  size = 160,
}: {
  label: string;
  icon?: string;
  onClick: () => void;
  size?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="cloud-cta-button"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(145deg, ${colors.skyBlue}, ${colors.lavender})`,
        boxShadow: buttonShadow,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textOnColor,
      }}
    >
      <span style={{ fontSize: size * 0.28 }}>{icon}</span>
      <span style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{label}</span>
      <style jsx>{`
        .cloud-cta-button {
          animation: breathe 2s ease-in-out infinite;
          transition: transform 0.15s ease;
        }
        .cloud-cta-button:active {
          transform: scale(0.96);
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </button>
  );
}

interface CloudParticle {
  id: number;
  left: number; // 相對容器寬度的百分比位置
  delay: number; // 動畫延遲，讓多朵雲飄出時錯開
  drift: number; // 往上飄的距離
  scale: number; // 大小差異
}

function CloudParticleLayer({
  trigger,
  count = 3,
  particleColor,
  particleEmoji = '☁️',
  originXPercent = 50,
}: {
  trigger: number;
  count?: number; // 這次要冒出幾朵雲（長按越久，數字越大）
  particleColor: string;
  particleEmoji?: string;
  originXPercent?: number; // 冒出的起始位置（容器寬度的百分比），預設置中
}) {
  const [particles, setParticles] = useState<CloudParticle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const n = Math.max(1, Math.min(18, Math.round(count)));
    // 雲朵集中從同一個點（棒子尾巴附近）冒出，數量越多、扇形擴散越廣
    const newOnes: CloudParticle[] = Array.from({ length: n }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      left: originXPercent + (Math.random() * 26 - 13),
      delay: Math.random() * 0.28,
      drift: 70 + Math.random() * 55,
      scale: 0.8 + Math.random() * 0.55,
    }));
    setParticles((prev) => [...prev, ...newOnes]);
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newOnes.find((n2) => n2.id === p.id)));
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {particles.map((p) => (
        <span
          key={p.id}
          className="drift-cloud"
          style={
            {
              position: 'absolute',
              top: '85%',
              left: `${p.left}%`,
              fontSize: 22 * p.scale,
              color: particleColor,
              animationDelay: `${p.delay}s`,
              '--drift-y': `-${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {particleEmoji}
        </span>
      ))}
      <style jsx>{`
        .drift-cloud {
          transform: translate(-50%, -50%);
          animation: drift 1.7s ease-out forwards;
        }
        @keyframes drift {
          0% { transform: translate(-50%, -50%) translateY(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translateY(var(--drift-y, -90px)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function CharacterAvatar({
  character,
  nickname,
  state,
}: {
  character: CharacterType;
  nickname: string;
  state: CharacterState;
}) {
  const overlay = state === 'inhale' ? '✨' : state === 'exhale' ? '☁️' : state === 'relaxed' ? '😌' : null;
  const scale = state === 'inhale' ? 1.1 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
          transform: `scale(${scale})`,
          transition: 'transform 0.25s ease',
        }}
      >
        {CHARACTER_EMOJI[character]}
        {overlay && <span style={{ position: 'absolute', top: -8, right: -4, fontSize: 20 }}>{overlay}</span>}
      </div>
      <div
        style={{
          marginTop: 6,
          background: colors.lavender,
          borderRadius: 999,
          padding: '2px 10px',
          fontSize: 13,
          color: colors.textOnColor,
        }}
      >
        {nickname}
      </div>
    </div>
  );
}

/* ============================================================
   呼吸棒元件 — 用來取代寫實菸支的可愛道具（橫向版本）
   握把（固定在左側，顏色可換）+ 棒身（隨 progress 由右往左變短，顏色可換）
   尖端有微光符號取代火光（可換）；不含任何寫實香菸的視覺元素、不印文字。
   ============================================================ */

function CloudCandleStick({
  progress,
  width = 220,
  height = 64,
  handleColor = '#2B2B33',
  handleStroke = '#1A1A20',
  bodyFill = '#FFB6D9',
  bodyStroke = '#FF9FCB',
  tipEmoji = '💗',
}: {
  progress: number;
  width?: number;
  height?: number;
  handleColor?: string;
  handleStroke?: string;
  bodyFill?: string;
  bodyStroke?: string;
  tipEmoji?: string;
}) {
  const handleWidth = width * 0.22; // 握把固定寬度（在左側）
  const bodyFullWidth = width - handleWidth; // 棒身滿格時的寬度
  const clamped = Math.max(0, Math.min(100, progress));
  const visibleBodyWidth = (bodyFullWidth * clamped) / 100;

  const bodyBaseX = handleWidth; // 棒身左緣（跟握把交界，固定不動）
  const bodyHeight = height * 0.5;
  const bodyY = (height - bodyHeight) / 2;
  const clipId = `stick-clip-h-${width}-${height}-${bodyFill.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={bodyBaseX}
            y={0}
            width={visibleBodyWidth}
            height={height}
            style={{ transition: 'width 0.6s ease' }}
          />
        </clipPath>
      </defs>

      {/* 棒身：單純膠囊柱狀 + 白色柔光帶，透過 clipPath 從右往左被「吃掉」 */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={bodyBaseX}
          y={bodyY}
          width={bodyFullWidth}
          height={bodyHeight}
          rx={bodyHeight / 2}
          fill={bodyFill}
          stroke={bodyStroke}
          strokeWidth={1.5}
        />
        {/* 中央一條柔光帶，增加發光質感 */}
        <rect
          x={bodyBaseX}
          y={bodyY + bodyHeight * 0.28}
          width={bodyFullWidth}
          height={bodyHeight * 0.2}
          rx={bodyHeight * 0.1}
          fill="#FFFFFF"
          opacity={0.5}
        />
      </g>

      {/* 握把：固定不變，代表「拿在手上的部分」 */}
      <rect
        x={0}
        y={bodyY}
        width={handleWidth}
        height={bodyHeight}
        rx={bodyHeight * 0.18}
        fill={handleColor}
        stroke={handleStroke}
        strokeWidth={1.5}
      />

      {/* 尖端微光，取代火光，還沒燒完時才顯示，位置跟著右緣一起往左退 */}
      {clamped > 0 && (
        <text
          x={Math.min(width - 6, bodyBaseX + visibleBodyWidth + 4)}
          y={height / 2 + 5}
          textAnchor="middle"
          fontSize={16}
          className="stick-sparkle"
        >
          {tipEmoji}
        </text>
      )}

      <style jsx>{`
        .stick-sparkle {
          animation: sparkle-pulse 1.6s ease-in-out infinite;
        }
        @keyframes sparkle-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </svg>
  );
}

/* ============================================================
   肺部圖示 — 抽越多、肺會越黑
   依「累積休息次數」計算黑化程度（0 ~ 1），從粉嫩色漸變到深黑色
   ============================================================ */

function hexLerp(hexA: string, hexB: string, t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const ar = parseInt(a.substring(0, 2), 16);
  const ag = parseInt(a.substring(2, 4), 16);
  const ab = parseInt(a.substring(4, 6), 16);
  const br = parseInt(b.substring(0, 2), 16);
  const bg = parseInt(b.substring(2, 4), 16);
  const bb = parseInt(b.substring(4, 6), 16);
  const r = Math.round(ar + (br - ar) * clamp);
  const g = Math.round(ag + (bg - ag) * clamp);
  const bl = Math.round(ab + (bb - ab) * clamp);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

// 累積放空次數達到這個數字時，肺會呈現完全黑化
const LUNG_FULLY_BLACK_AT_COUNT = 200;

function LungIcon({ totalRestCount, size = 96 }: { totalRestCount: number; size?: number }) {
  const t = Math.max(0, Math.min(1, totalRestCount / LUNG_FULLY_BLACK_AT_COUNT));
  const fill = hexLerp('#FFD6E7', '#26262E', t);
  const stroke = hexLerp('#FF9FCB', '#0D0D10', t);
  const spotOpacity = 0.12 + t * 0.4; // 抽越多，黑斑越明顯

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* 氣管 */}
      <rect x="46" y="4" width="8" height="26" rx="4" fill={stroke} opacity={0.85} />
      {/* 左肺 */}
      <path
        d="M46,26 C30,24 14,34 10,54 C7,70 14,86 28,88 C36,89 39,80 38,66 C37,52 40,34 46,26 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
      {/* 右肺 */}
      <path
        d="M54,26 C70,24 86,34 90,54 C93,70 86,86 72,88 C64,89 61,80 62,66 C63,52 60,34 54,26 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
      {/* 累積抽越多，浮現的黑斑就越深越明顯 */}
      <circle cx="24" cy="55" r="6" fill={stroke} opacity={spotOpacity} />
      <circle cx="34" cy="70" r="4" fill={stroke} opacity={spotOpacity} />
      <circle cx="76" cy="60" r="5" fill={stroke} opacity={spotOpacity} />
      <circle cx="68" cy="75" r="3.5" fill={stroke} opacity={spotOpacity} />
    </svg>
  );
}

/* ============================================================
   陪抽房核心互動邏輯（自訂 Hook）
   規則：沒有長按的情況下，一支菸靜靜燒完需要 10 分鐘（被動消耗）；
   長按按鈕期間會「加速」消耗，放開後恢復正常被動速度。
   放開時吐出的雲朵數量，取決於這次長按了多久：按越久，雲越多。
   ============================================================ */

const PASSIVE_BURN_DURATION_SECONDS = 600; // 沒按的話，一支菸燒 10 分鐘
const BASE_DRAIN_PER_SECOND = 100 / PASSIVE_BURN_DURATION_SECONDS; // 被動消耗速度
const HOLD_EXTRA_DRAIN_PER_SECOND = 0.8; // 長按時額外加速消耗的速度（數字越大燒越快）
const AUTO_PUFF_INTERVAL_SECONDS = 14; // 沒按的時候，每隔幾秒自動冒一次雲（模擬真的在抽）
const AUTO_PUFF_CLOUD_COUNT = 3; // 自動冒雲時的預設雲朵數

// 長按秒數 → 吐出的雲朵數量：長按 1 秒只有一點點雲，長按 10 秒會有很多雲
function computeHoldCloudCount(holdSeconds: number): number {
  if (holdSeconds <= 0) return 1;
  return Math.max(1, Math.min(16, Math.round(1 + holdSeconds * 1.3)));
}

function usePuffRoom(onFinished: (durationSeconds: number) => void, started: boolean) {
  const [cigaretteLength, setCigaretteLength] = useState(100);
  const [characterState, setCharacterState] = useState<CharacterState>('idle');
  const [puffTrigger, setPuffTrigger] = useState(0);
  const [puffCount, setPuffCount] = useState(AUTO_PUFF_CLOUD_COUNT);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const finishedRef = useRef(false);
  const isHoldingRef = useRef(false);
  const elapsedRef = useRef(0);
  const lengthRef = useRef(100);
  const lastAutoPuffRef = useRef(0);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerExhale = useCallback((count: number = AUTO_PUFF_CLOUD_COUNT) => {
    setCharacterState('exhale');
    setPuffCount(count);
    setPuffTrigger((t) => t + 1);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      if (!finishedRef.current && !isHoldingRef.current) setCharacterState('idle');
    }, 800);
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      if (finishedRef.current) return;

      elapsedRef.current += 1;
      setElapsedSeconds(elapsedRef.current);

      // 被動消耗 + 長按時額外加速消耗
      const drain = BASE_DRAIN_PER_SECOND + (isHoldingRef.current ? HOLD_EXTRA_DRAIN_PER_SECOND : 0);
      lengthRef.current = Math.max(0, lengthRef.current - drain);
      setCigaretteLength(lengthRef.current);

      // 沒有長按時，每隔一段時間自動冒一次可愛雲朵
      if (!isHoldingRef.current && elapsedRef.current - lastAutoPuffRef.current >= AUTO_PUFF_INTERVAL_SECONDS) {
        lastAutoPuffRef.current = elapsedRef.current;
        triggerExhale();
      }

      // 燒完
      if (lengthRef.current <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        setCharacterState('relaxed');
        onFinished(elapsedRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [onFinished, triggerExhale, started]);

  const handleHoldStart = useCallback(() => {
    if (finishedRef.current) return;
    isHoldingRef.current = true;
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    setCharacterState('inhale');
  }, []);

  const handleHoldEnd = useCallback(
    (holdSeconds: number = 0) => {
      if (finishedRef.current) return;
      isHoldingRef.current = false;
      triggerExhale(computeHoldCloudCount(holdSeconds));
    },
    [triggerExhale]
  );

  return {
    cigaretteLength,
    characterState,
    puffTrigger,
    puffCount,
    durationSeconds: elapsedSeconds,
    handleHoldStart,
    handleHoldEnd,
  };
}

/* ============================================================
   畫面：首頁
   ============================================================ */

function HomeScreen({
  user,
  coins,
  unreadNotificationCount,
  onStartPuff,
  onGoShop,
  onGoBackpack,
  onGoNotifications,
  onViewFriend,
  onAddFriend,
  friends,
  friendProfiles,
  skins,
}: {
  user: UserData;
  coins: number;
  unreadNotificationCount: number;
  onStartPuff: () => void;
  onGoShop: () => void;
  onGoBackpack: () => void;
  onGoNotifications: () => void;
  onViewFriend: (nickname: string) => void;
  onAddFriend: (nickname: string) => void;
  friends: string[];
  friendProfiles: Record<string, CharacterType | null>;
  skins: SkinData[];
}) {
  const progress = (user.exp / user.expToNextLevel) * 100;
  const totalStickCount = skins.reduce((sum, s) => sum + s.quantity, 0);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');

  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      {/* 頂部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>{`don't smoke`}</h1>
        <div style={{ display: 'flex', gap: spacing.md, fontSize: 20, alignItems: 'center' }}>
          <button onClick={onGoBackpack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0 }}>
            🎒
          </button>
          <button onClick={onGoShop} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0 }}>
            🛍️
          </button>
          <button
            onClick={onGoNotifications}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0 }}
          >
            🔔
            {unreadNotificationCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: colors.danger,
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                }}
              >
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>
          <span>⚙️</span>
        </div>
      </div>

      {/* 個人資料卡 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <AvatarBubble character={user.avatarCharacter} size={64} status={user.onlineStatus} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary }}>{user.nickname}</span>
              <span style={{ background: colors.mintGreen, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 600, color: colors.textPrimary }}>
                Lv.{user.level}
              </span>
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, margin: '4px 0' }}>稱號：{user.title}</div>
            <ProgressBar progress={progress} />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTop: `1px solid ${colors.surfaceMuted}`,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>🪙 零錢包</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{coins} 元</span>
        </div>
      </Card>

      {/* 主 CTA：背包沒有呼吸棒的話，按下去改成先去商城兌換 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: `${spacing.xl}px 0`, gap: spacing.xs }}>
        <CloudButton label="開抽" onClick={totalStickCount > 0 ? onStartPuff : onGoShop} />
        {totalStickCount === 0 && (
          <div style={{ fontSize: 12, color: colors.textSecondary }}>背包沒有呼吸棒了，點一下前往商城兌換</div>
        )}
      </div>

      {/* 我的好友：加過的朋友會顯示在這裡，點頭像可以直接看他的放空紀錄 */}
      <SectionHeader title="我的好友" />
      <div style={{ display: 'flex', gap: spacing.md, overflowX: 'auto', paddingBottom: spacing.xs, alignItems: 'flex-start' }}>
        {friends.map((f) => {
          const profileCharacter = friendProfiles[f];
          return (
            <button
              key={f}
              onClick={() => onViewFriend(f)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 60,
                flexShrink: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <AvatarBubble character={profileCharacter ?? 'cat'} status="online" size={52} />
              <span
                style={{
                  fontSize: 12,
                  color: colors.textPrimary,
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 60,
                }}
              >
                {f}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setShowAddFriend((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: colors.surfaceMuted,
            border: `2px dashed ${colors.lavender}`,
            color: colors.lavender,
            fontSize: 24,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>
      {friends.length === 0 && !showAddFriend && (
        <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>還沒有好友，點右邊的 + 新增一個</div>
      )}

      {showAddFriend && (
        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
          <input
            value={addFriendInput}
            onChange={(e) => setAddFriendInput(e.target.value)}
            placeholder="輸入朋友的暱稱"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: radius.input,
              border: `1px solid ${colors.surfaceMuted}`,
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              const name = addFriendInput.trim();
              if (name) {
                onAddFriend(name);
                setAddFriendInput('');
                setShowAddFriend(false);
              }
            }}
            style={{
              padding: `0 ${spacing.md}px`,
              borderRadius: radius.pill,
              border: 'none',
              background: colors.lavender,
              color: colors.textOnColor,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            加好友
          </button>
        </div>
      )}

    </div>
  );
}

function SectionHeader({ title, onPressMore }: { title: string; onPressMore?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: `${spacing.md}px 0 ${spacing.sm}px` }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>{title}</h2>
      {onPressMore && (
        <button
          onClick={onPressMore}
          style={{ background: 'none', border: 'none', fontSize: 13, color: colors.textSecondary, cursor: 'pointer' }}
        >
          查看全部 ›
        </button>
      )}
    </div>
  );
}

/* ============================================================
   畫面：陪抽房
   ============================================================ */

function PuffRoomScreen({
  user,
  skins,
  onConfirmSkin,
  onFinished,
  onExit,
}: {
  user: UserData;
  skins: SkinData[];
  onConfirmSkin: (skinId: string) => void;
  onFinished: (durationSeconds: number) => void;
  onExit: () => void;
}) {
  // 還沒選呼吸棒之前是 null：要先選一隻才會真的開始燒
  const [pickedSkinId, setPickedSkinId] = useState<string | null>(null);
  const equippedSkin = skins.find((s) => s.id === pickedSkinId) ?? skins[0];

  const { cigaretteLength, characterState, puffTrigger, puffCount, durationSeconds, handleHoldStart, handleHoldEnd } =
    usePuffRoom(onFinished, pickedSkinId !== null);

  const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, '0');
  const seconds = String(durationSeconds % 60).padStart(2, '0');

  const handlePickSkin = (skinId: string) => {
    onConfirmSkin(skinId); // 立刻扣背包庫存 1 隻、休息紀錄 +1
    setPickedSkinId(skinId); // 鎖定這次要抽的款式，抽完前不能再換
  };

  // 階段一：選呼吸棒（選了就鎖定，不能再換）
  if (!pickedSkinId) {
    return (
      <div style={{ minHeight: '100vh', background: colors.background, paddingBottom: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.sm}px ${spacing.lg}px` }}>
          <button onClick={onExit} style={{ background: 'none', border: 'none', fontSize: 16, color: colors.textPrimary, cursor: 'pointer' }}>
            ← 退出房間
          </button>
        </div>
        <div style={{ padding: `0 ${spacing.lg}px` }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: `0 0 ${spacing.xs}px` }}>選一隻呼吸棒開始抽</h2>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
            選好之後就會鎖定，這次沒抽完不能再換其他款式喔
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            {skins.map((skin) => {
              const owned = skin.quantity > 0;
              return (
                <button
                  key={skin.id}
                  onClick={() => owned && handlePickSkin(skin.id)}
                  disabled={!owned}
                  style={{
                    background: colors.surface,
                    borderRadius: radius.card,
                    padding: spacing.md,
                    textAlign: 'center',
                    boxShadow: cardShadow,
                    border: 'none',
                    cursor: owned ? 'pointer' : 'default',
                    opacity: owned ? 1 : 0.45,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 40 }}>
                    {owned ? (
                      <CloudCandleStick
                        progress={100}
                        width={110}
                        height={32}
                        handleColor={skin.handleColor}
                        handleStroke={skin.handleStroke}
                        bodyFill={skin.bodyFill}
                        bodyStroke={skin.bodyStroke}
                        tipEmoji={skin.tipEmoji}
                      />
                    ) : (
                      <span style={{ fontSize: 24 }}>🔒</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, marginTop: 8 }}>{skin.name}</div>
                  <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>背包 x{skin.quantity}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 階段二：燃燒中（已鎖定款式，不能再換）
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${colors.skyBlue}33, ${colors.background})`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* 頂部列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.sm}px ${spacing.lg}px` }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', fontSize: 16, color: colors.textPrimary, cursor: 'pointer' }}>
          ← 退出房間
        </button>
        <span style={{ fontSize: 13, color: colors.textSecondary }}>
          ⏱ 已放空 {minutes}:{seconds}
        </span>
      </div>

      {/* 目前使用的呼吸棒（已鎖定，抽完前不能換） */}
      <div style={{ textAlign: 'center', fontSize: 13, color: colors.textSecondary }}>
        使用中：{equippedSkin.name}（這次抽完前不能換）
      </div>

      {/* 一個人的角色（個人放空模式） */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: spacing.lg }}>
        <CharacterAvatar
          character={user.avatarCharacter}
          nickname={user.nickname}
          state={characterState}
        />
      </div>

      {/* 橫向呼吸棒：握把在左，棒身隨進度從右往左變短（外觀依裝備的收藏款式而定） */}
      {/* 粒子從棒子尾巴（右側）附近冒出，往上飄散 */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: spacing.xl, height: 64 }}>
        <CloudCandleStick
          progress={cigaretteLength}
          width={240}
          height={64}
          handleColor={equippedSkin.handleColor}
          handleStroke={equippedSkin.handleStroke}
          bodyFill={equippedSkin.bodyFill}
          bodyStroke={equippedSkin.bodyStroke}
          tipEmoji={equippedSkin.tipEmoji}
        />
        <div style={{ position: 'absolute', left: '50%', bottom: '100%', width: 240, marginLeft: -120, height: 120 }}>
          <CloudParticleLayer
            trigger={puffTrigger}
            count={puffCount}
            particleColor={equippedSkin.particleColor}
            particleEmoji={equippedSkin.particleEmoji}
            originXPercent={78}
          />
        </div>
      </div>

      {/* 說明文字：不按大約 10 分鐘燒完，長按會加速消耗 */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginTop: spacing.md, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          呼吸棒剩餘 {Math.round(cigaretteLength)}%　（放著不按約 10 分鐘燒完，長按會加速消耗）
        </div>
      </div>

      {/* 互動按鈕：按住會讓菸加速變短，放開恢復正常速度；長按越久，放開時吐出的雲越多 */}
      <div style={{ padding: spacing.lg, marginTop: 'auto' }}>
        <HoldToPuffButton onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
        <div style={{ textAlign: 'center', fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs }}>
          💡 長按越久，放開時吐出的雲會越多喔
        </div>
      </div>
    </div>
  );
}

function HoldToPuffButton({
  onHoldStart,
  onHoldEnd,
}: {
  onHoldStart: () => void;
  onHoldEnd: (holdSeconds: number) => void;
}) {
  const [holding, setHolding] = useState(false);
  const startRef = useRef<number | null>(null);

  const start = () => {
    setHolding(true);
    startRef.current = Date.now();
    onHoldStart();
  };
  const end = () => {
    setHolding(false);
    const startedAt = startRef.current;
    startRef.current = null;
    const holdSeconds = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    onHoldEnd(holdSeconds);
  };

  return (
    <button
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={() => holding && end()}
      onTouchStart={start}
      onTouchEnd={end}
      className="hold-puff-button"
      style={{
        width: '100%',
        padding: '18px 0',
        borderRadius: radius.pill,
        border: 'none',
        cursor: 'pointer',
        fontSize: 17,
        fontWeight: 600,
        color: colors.textOnColor,
        background: holding ? colors.lavender : colors.skyBlue,
        transform: holding ? 'scale(1.03)' : 'scale(1)',
        transition: 'background 0.3s ease, transform 0.2s ease',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      長按吸氣 ⤴ 放開吐雲
    </button>
  );
}

/* ============================================================
   畫面：結算頁
   ============================================================ */

function ResultScreen({
  durationSeconds,
  onReplay,
  onBackHome,
}: {
  durationSeconds: number;
  onReplay: () => void;
  onBackHome: () => void;
}) {
  const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, '0');
  const seconds = String(durationSeconds % 60).padStart(2, '0');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: spacing.xxl * 2,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <div style={{ fontSize: 48 }}>🔥</div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>熄滅了～辛苦了</h2>

      <Card style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>本次陪伴時長</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>
          {minutes}:{seconds}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: spacing.md, width: '100%', maxWidth: 360, marginTop: spacing.lg }}>
        <button
          onClick={onReplay}
          style={{ flex: 1, padding: '14px 0', borderRadius: radius.pill, border: 'none', background: colors.lavender, color: colors.textOnColor, fontWeight: 600, cursor: 'pointer' }}
        >
          再開一支
        </button>
        <button
          onClick={onBackHome}
          style={{ flex: 1, padding: '14px 0', borderRadius: radius.pill, border: 'none', background: colors.surfaceMuted, color: colors.textPrimary, fontWeight: 600, cursor: 'pointer' }}
        >
          返回主頁
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   小遊戲：我是好寶寶
   地上散落著呼吸棒，點一下把它撿進菸灰缸裡，每撿一隻零錢包 +1 元。
   呼吸棒無限生成：撿走一隻，馬上會在別的地方冒出一隻新的。
   ============================================================ */

/* ============================================================
   菸蒂圖示 — 純 SVG，地上散落的可點擊垃圾
   白色菸身 + 黃褐色濾嘴 + 燒黑的斷口，帶一點隨機傾斜
   ============================================================ */

function CigaretteButtIcon({ size = 40, rotate = 0 }: { size?: number; rotate?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.4}
      viewBox="0 0 100 40"
      style={{ display: 'block', transform: `rotate(${rotate}deg)` }}
    >
      {/* 淡淡的落地陰影 */}
      <ellipse cx="50" cy="33" rx="40" ry="4" fill="#4A4A5A" opacity="0.12" />

      {/* 濾嘴（左側，黃褐色） */}
      <rect x="4" y="11" width="34" height="15" rx="7.5" fill="#D9A25A" />
      {/* 濾嘴上的細紋 */}
      <rect x="12" y="11" width="2" height="15" fill="#C08F4A" opacity="0.35" />
      <rect x="20" y="11" width="2" height="15" fill="#C08F4A" opacity="0.35" />
      <rect x="28" y="11" width="2" height="15" fill="#C08F4A" opacity="0.35" />

      {/* 菸身（白色紙捲） */}
      <rect x="34" y="11" width="52" height="15" rx="7.5" fill="#FAF7EF" />
      {/* 菸身下緣的一點灰影，做出圓柱感 */}
      <rect x="34" y="20" width="52" height="6" rx="3" fill="#D8D4C8" opacity="0.5" />

      {/* 燒黑的斷口 */}
      <rect x="79" y="11" width="9" height="15" rx="4" fill="#3A3A44" />
      <ellipse cx="87" cy="18.5" rx="3" ry="7" fill="#1C1C23" />
    </svg>
  );
}

/* ============================================================
   菸灰缸圖示 — 純 SVG 畫的，不需要上傳任何圖片檔
   深色缸體 + 兩道凹槽 + 缸內菸灰與菸屁股 + 一縷輕煙
   ============================================================ */

function AshtrayIcon({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.02} viewBox="0 -50 200 206" style={{ display: 'block' }}>
      <defs>
        {/* 缸體：左亮右暗的立體感 */}
        <linearGradient id="ashtray-body" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor="#54545F" />
          <stop offset="40%" stopColor="#3A3A44" />
          <stop offset="100%" stopColor="#22222A" />
        </linearGradient>
        {/* 缸內：越靠內側越暗 */}
        <radialGradient id="ashtray-bowl" cx="0.5" cy="0.38" r="0.62">
          <stop offset="0%" stopColor="#15151B" />
          <stop offset="70%" stopColor="#26262E" />
          <stop offset="100%" stopColor="#33333D" />
        </radialGradient>
      </defs>

      {/* 三隻小腳 */}
      <ellipse cx="58" cy="146" rx="9" ry="6" fill="#1C1C23" />
      <ellipse cx="142" cy="146" rx="9" ry="6" fill="#1C1C23" />

      {/* 缸體主體 */}
      <path
        d="M18,74 C18,112 52,142 100,142 C148,142 182,112 182,74 C182,58 168,50 152,50 L48,50 C32,50 18,58 18,74 Z"
        fill="url(#ashtray-body)"
      />
      {/* 缸口外緣 */}
      <ellipse cx="100" cy="56" rx="82" ry="34" fill="url(#ashtray-body)" />
      {/* 缸口內側凹陷 */}
      <ellipse cx="100" cy="58" rx="62" ry="24" fill="url(#ashtray-bowl)" />

      {/* 缸緣兩側的放菸凹槽 */}
      <ellipse cx="26" cy="52" rx="13" ry="6" fill="#15151B" opacity="0.9" transform="rotate(-14 26 52)" />
      <ellipse cx="174" cy="52" rx="13" ry="6" fill="#15151B" opacity="0.9" transform="rotate(14 174 52)" />

      {/* 缸體上的一道裂痕 */}
      <path d="M112,88 L118,102 L112,112 L120,126" stroke="#15151B" strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />

      {/* 缸內的菸灰堆 */}
      <ellipse cx="100" cy="60" rx="48" ry="16" fill="#4A4A52" opacity="0.75" />
      <ellipse cx="84" cy="58" rx="18" ry="7" fill="#6E6E78" opacity="0.55" />
      <ellipse cx="120" cy="63" rx="15" ry="6" fill="#5C5C66" opacity="0.5" />

      {/* 缸內的菸屁股們 */}
      {/* 中間偏左，斜插在灰裡 */}
      <g transform="rotate(-24 92 54)">
        <rect x="74" y="48" width="30" height="11" rx="5.5" fill="#F2EFE6" />
        <rect x="96" y="48" width="14" height="11" rx="5.5" fill="#D9A25A" />
      </g>
      {/* 右邊那支綠色的 */}
      <g transform="rotate(64 132 46)">
        <rect x="116" y="40" width="26" height="10" rx="5" fill="#93A87E" />
        <rect x="136" y="40" width="12" height="10" rx="5" fill="#C9A96B" />
      </g>
      {/* 右下角一支橫的 */}
      <g transform="rotate(12 128 68)">
        <rect x="112" y="63" width="26" height="10" rx="5" fill="#EDE9DE" />
        <rect x="132" y="63" width="13" height="10" rx="5" fill="#D9A25A" />
      </g>
      {/* 左下角露出濾嘴 */}
      <g transform="rotate(-8 74 68)">
        <rect x="62" y="63" width="16" height="10" rx="5" fill="#D9A25A" />
      </g>

      {/* 架在左緣凹槽上、還在燒的那一支 */}
      <g transform="rotate(-14 40 50)">
        <rect x="2" y="45" width="44" height="11" rx="5.5" fill="#FAF7EF" />
        <rect x="2" y="45" width="18" height="11" rx="5.5" fill="#D9A25A" />
        <rect x="44" y="45" width="5" height="11" rx="2.5" fill="#3A3A44" />
      </g>

      {/* 一縷輕煙 */}
      <path
        className="ashtray-smoke"
        d="M96,40 C88,24 104,16 98,2 C94,-12 102,-26 108,-40"
        stroke="#B9B9C4"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        className="ashtray-smoke-2"
        d="M108,42 C116,28 104,16 112,0 C116,-10 112,-20 116,-30"
        stroke="#B9B9C4"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.32"
      />

      <style jsx>{`
        .ashtray-smoke {
          animation: smoke-drift 4s ease-in-out infinite;
        }
        .ashtray-smoke-2 {
          animation: smoke-drift 4s ease-in-out infinite 1.2s;
        }
        @keyframes smoke-drift {
          0%, 100% { opacity: 0.18; transform: translateX(0) scaleY(1); }
          50% { opacity: 0.5; transform: translateX(4px) scaleY(1.08); }
        }
      `}</style>
    </svg>
  );
}

interface GroundStick {
  id: number;
  x: number; // 在遊戲區內的水平位置（百分比）
  y: number; // 在遊戲區內的垂直位置（百分比）
  rotate: number; // 躺在地上的傾斜角度，讓每根菸蒂看起來方向不同
  collecting: boolean; // 是否正在飛向菸灰缸的動畫中
}

function randomGroundStick(): GroundStick {
  return {
    id: Date.now() + Math.random(),
    x: 10 + Math.random() * 78, // 10% ~ 88%
    y: 8 + Math.random() * 55, // 8% ~ 63%，留空間給下面的菸灰缸
    rotate: Math.random() * 360,
    collecting: false,
  };
}

function GoodKidGameScreen({
  coins,
  onEarnCoin,
}: {
  coins: number;
  onEarnCoin: (amount: number) => void;
}) {
  const [sticks, setSticks] = useState<GroundStick[]>(() =>
    Array.from({ length: GOOD_KID_STICK_COUNT }).map(() => randomGroundStick())
  );
  const [collectedThisRound, setCollectedThisRound] = useState(0);

  const handlePickStick = (id: number) => {
    setSticks((prev) => prev.map((s) => (s.id === id ? { ...s, collecting: true } : s)));
    onEarnCoin(GOOD_KID_COIN_PER_STICK);
    setCollectedThisRound((c) => c + 1);
    // 飛進菸灰缸的動畫播完後，把這隻換成新的一隻（呼吸棒無限生成，不會撿完）
    setTimeout(() => {
      setSticks((prev) => [...prev.filter((s) => s.id !== id), randomGroundStick()]);
    }, 320);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${colors.mintGreen}55, ${colors.background})`,
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 100,
      }}
    >
      {/* 頂部列 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: `${spacing.sm}px ${spacing.lg}px` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>🪙 {coins} 元</span>
      </div>

      <div style={{ textAlign: 'center', padding: `0 ${spacing.lg}px` }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' }}>🧸 我是好寶寶</h2>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          請學會把菸蒂丟進菸灰缸
        </div>
      </div>

      {/* 遊戲區：地上散落著呼吸棒，點了就會飛進畫面下方的菸灰缸 */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          margin: `${spacing.md}px ${spacing.lg}px`,
          borderRadius: radius.card,
          background: colors.surface,
          boxShadow: cardShadow,
          overflow: 'hidden',
          minHeight: 340,
        }}
      >
        {sticks.map((s) => (
          <button
            key={s.id}
            onClick={() => !s.collecting && handlePickStick(s.id)}
            disabled={s.collecting}
            style={{
              position: 'absolute',
              left: `${s.collecting ? 50 : s.x}%`,
              top: `${s.collecting ? 92 : s.y}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.3s ease, top 0.3s ease, opacity 0.3s ease',
              opacity: s.collecting ? 0 : 1,
              background: 'none',
              border: 'none',
              cursor: s.collecting ? 'default' : 'pointer',
              padding: 0,
              lineHeight: 0,
            }}
          >
            <CigaretteButtIcon size={46} rotate={s.rotate} />
          </button>
        ))}

        {/* 菸灰缸：固定在遊戲區下方置中 */}
        <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          <AshtrayIcon size={110} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   畫面：商城 — 每款呼吸棒 200 元／20 隻，用零錢包的錢購買
   ============================================================ */

function ShopScreen({
  skins,
  coins,
  breathThiefCount,
  onPurchase,
  onBuyBreathThief,
  onBack,
}: {
  skins: SkinData[];
  coins: number;
  breathThiefCount: number;
  onPurchase: (skinId: string) => void;
  onBuyBreathThief: () => void;
  onBack: () => void;
}) {
  const canAffordThief = coins >= BREATH_THIEF_PRICE;
  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', fontSize: 15, color: colors.textSecondary, cursor: 'pointer', padding: 0, marginBottom: spacing.sm }}
      >
        ← 返回
      </button>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, marginBottom: spacing.xs }}>🛍️ 商城</h1>
      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>
        每次購買直接拿到 20 隻，會放進背包裡 ✨
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary, marginBottom: spacing.md }}>
        🪙 零錢包餘額：{coins} 元
      </div>

      {/* 道具：呼吸小偷 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          background: colors.surface,
          borderRadius: radius.card,
          padding: spacing.md,
          boxShadow: cardShadow,
          marginBottom: spacing.md,
        }}
      >
        <div style={{ fontSize: 36 }}>🕵️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>呼吸小偷</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            去背包裡使用，隨機偷走朋友 1～50 隻呼吸棒
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>目前擁有 x{breathThiefCount}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#5FBF9F' }}>{BREATH_THIEF_PRICE} 元</div>
          <button
            onClick={() => canAffordThief && onBuyBreathThief()}
            disabled={!canAffordThief}
            style={{
              padding: '6px 14px',
              borderRadius: radius.pill,
              border: 'none',
              cursor: canAffordThief ? 'pointer' : 'default',
              fontWeight: 600,
              fontSize: 13,
              background: canAffordThief ? colors.lavender : colors.surfaceMuted,
              color: canAffordThief ? colors.textOnColor : colors.textSecondary,
            }}
          >
            {canAffordThief ? '購買' : '餘額不足'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
        {skins.map((skin) => {
          const affordable = coins >= skin.price;
          return (
            <div
              key={skin.id}
              style={{
                background: colors.surface,
                borderRadius: radius.card,
                padding: spacing.md,
                textAlign: 'center',
                boxShadow: cardShadow,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 40 }}>
                <CloudCandleStick
                  progress={100}
                  width={110}
                  height={32}
                  handleColor={skin.handleColor}
                  handleStroke={skin.handleStroke}
                  bodyFill={skin.bodyFill}
                  bodyStroke={skin.bodyStroke}
                  tipEmoji={skin.tipEmoji}
                />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginTop: 8 }}>{skin.name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#5FBF9F', marginTop: 4 }}>{skin.price} 元 / 20 隻</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>背包目前 x{skin.quantity}</div>
              <button
                onClick={() => affordable && onPurchase(skin.id)}
                disabled={!affordable}
                style={{
                  marginTop: spacing.sm,
                  width: '100%',
                  padding: '8px 0',
                  borderRadius: radius.pill,
                  border: 'none',
                  cursor: affordable ? 'pointer' : 'default',
                  fontWeight: 600,
                  fontSize: 13,
                  background: affordable ? colors.lavender : colors.surfaceMuted,
                  color: affordable ? colors.textOnColor : colors.textSecondary,
                }}
              >
                {affordable ? '購買 +20' : '餘額不足'}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
        沒錢了嗎？回首頁玩「🧸 我是好寶寶」小遊戲賺零用錢吧
      </div>
    </div>
  );
}

/* ============================================================
   畫面：背包 — 顯示每種呼吸棒目前的庫存數量
   開抽一次會用掉 1 隻；商城買一次會補 20 隻進來。
   ============================================================ */

function BackpackScreen({
  skins,
  friends,
  breathThiefCount,
  onUseBreathThief,
  breathVoucherCount,
  onUseBreathVoucher,
  freePuffCount,
  onUseFreePuff,
  onBack,
  onGoShop,
}: {
  skins: SkinData[];
  friends: string[];
  breathThiefCount: number;
  onUseBreathThief: (targetNickname: string) => void;
  breathVoucherCount: number;
  onUseBreathVoucher: (targetNickname: string) => void;
  freePuffCount: number;
  onUseFreePuff: (targetNickname: string) => void;
  onBack: () => void;
  onGoShop: () => void;
}) {
  const totalCount = skins.reduce((sum, s) => sum + s.quantity, 0);
  const [showThiefPicker, setShowThiefPicker] = useState(false);
  const [showVoucherPicker, setShowVoucherPicker] = useState(false);
  const [showFreePuffPicker, setShowFreePuffPicker] = useState(false);

  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', fontSize: 15, color: colors.textSecondary, cursor: 'pointer', padding: 0, marginBottom: spacing.sm }}
      >
        ← 返回
      </button>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, marginBottom: spacing.xs }}>🎒 我的背包</h1>
      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
        目前共有 {totalCount} 隻呼吸棒，開抽一次會用掉 1 隻
      </div>

      {/* 道具：呼吸小偷 */}
      {breathThiefCount > 0 && (
        <div
          style={{
            background: colors.surface,
            borderRadius: radius.card,
            padding: spacing.md,
            boxShadow: cardShadow,
            marginBottom: spacing.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <div style={{ fontSize: 32 }}>🕵️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>呼吸小偷 x{breathThiefCount}</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>選一個朋友，隨機偷走他 1～50 隻呼吸棒</div>
            </div>
            <button
              onClick={() => setShowThiefPicker((v) => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: radius.pill,
                border: 'none',
                background: colors.lavender,
                color: colors.textOnColor,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              使用
            </button>
          </div>

          {showThiefPicker && (
            <div style={{ marginTop: spacing.md, borderTop: `1px solid ${colors.surfaceMuted}`, paddingTop: spacing.sm }}>
              {friends.length === 0 && (
                <div style={{ fontSize: 13, color: colors.textSecondary }}>還沒有好友可以偷，先去首頁加幾個好友吧</div>
              )}
              {friends.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    onUseBreathThief(f);
                    setShowThiefPicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 4px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `1px solid ${colors.surfaceMuted}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, color: colors.textPrimary }}>{f}</span>
                  <span style={{ fontSize: 13, color: colors.lavender, fontWeight: 600 }}>偷 TA →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 道具：呼吸券 — 完整抽完一支呼吸棒就會拿到一張，可以拿去搶朋友的錢 */}
      {breathVoucherCount > 0 && (
        <div
          style={{
            background: colors.surface,
            borderRadius: radius.card,
            padding: spacing.md,
            boxShadow: cardShadow,
            marginBottom: spacing.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <div style={{ fontSize: 32 }}>🎫</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>呼吸券 x{breathVoucherCount}</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                選一個朋友，搶走他 {ROB_MIN_AMOUNT}～{ROB_MAX_AMOUNT} 元
              </div>
            </div>
            <button
              onClick={() => setShowVoucherPicker((v) => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: radius.pill,
                border: 'none',
                background: colors.lavender,
                color: colors.textOnColor,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              使用
            </button>
          </div>

          {showVoucherPicker && (
            <div style={{ marginTop: spacing.md, borderTop: `1px solid ${colors.surfaceMuted}`, paddingTop: spacing.sm }}>
              {friends.length === 0 && (
                <div style={{ fontSize: 13, color: colors.textSecondary }}>還沒有好友可以搶，先去首頁加幾個好友吧</div>
              )}
              {friends.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    onUseBreathVoucher(f);
                    setShowVoucherPicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 4px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `1px solid ${colors.surfaceMuted}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, color: colors.textPrimary }}>{f}</span>
                  <span style={{ fontSize: 13, color: colors.lavender, fontWeight: 600 }}>搶 TA →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 道具：免費菸 — 只要開抽就會拿到一張（不用抽完），可以硬請朋友抽一支 */}
      {freePuffCount > 0 && (
        <div
          style={{
            background: colors.surface,
            borderRadius: radius.card,
            padding: spacing.md,
            boxShadow: cardShadow,
            marginBottom: spacing.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <div style={{ fontSize: 32 }}>🚬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>免費菸 x{freePuffCount}</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                請朋友抽一支，他的「累積二手菸」+1
              </div>
            </div>
            <button
              onClick={() => setShowFreePuffPicker((v) => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: radius.pill,
                border: 'none',
                background: '#2B2B33',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              使用
            </button>
          </div>

          {showFreePuffPicker && (
            <div style={{ marginTop: spacing.md, borderTop: `1px solid ${colors.surfaceMuted}`, paddingTop: spacing.sm }}>
              {friends.length === 0 && (
                <div style={{ fontSize: 13, color: colors.textSecondary }}>還沒有好友可以請，先去首頁加幾個好友吧</div>
              )}
              {friends.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    onUseFreePuff(f);
                    setShowFreePuffPicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 4px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `1px solid ${colors.surfaceMuted}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, color: colors.textPrimary }}>{f}</span>
                  <span style={{ fontSize: 13, color: colors.lavender, fontWeight: 600 }}>請 TA 抽 →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
        {skins.map((skin) => (
          <div
            key={skin.id}
            style={{
              background: colors.surface,
              borderRadius: radius.card,
              padding: spacing.md,
              textAlign: 'center',
              boxShadow: cardShadow,
              opacity: skin.quantity > 0 ? 1 : 0.5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 40 }}>
              {skin.quantity > 0 ? (
                <CloudCandleStick
                  progress={100}
                  width={110}
                  height={32}
                  handleColor={skin.handleColor}
                  handleStroke={skin.handleStroke}
                  bodyFill={skin.bodyFill}
                  bodyStroke={skin.bodyStroke}
                  tipEmoji={skin.tipEmoji}
                />
              ) : (
                <span style={{ fontSize: 24 }}>📦</span>
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginTop: 8 }}>{skin.name}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: skin.quantity > 0 ? colors.lavender : colors.textSecondary, marginTop: 2 }}>
              x{skin.quantity}
            </div>
          </div>
        ))}
      </div>

      {totalCount === 0 && (
        <button
          onClick={onGoShop}
          style={{
            marginTop: spacing.lg,
            width: '100%',
            padding: '14px 0',
            borderRadius: radius.pill,
            border: 'none',
            background: colors.lavender,
            color: colors.textOnColor,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          背包空了，前往商城兌換
        </button>
      )}
    </div>
  );
}

/* ============================================================
   畫面：放空紀錄（統計頁）
   自己看沒有返回鍵；點好友頭像進來看時會多一個返回鍵。
   ============================================================ */

function StatsScreen({
  nickname,
  avatarCharacter,
  stats,
  onBack,
  isFriend,
  onToggleFriend,
  onFreePuff,
  freePuffCount,
}: {
  nickname: string;
  avatarCharacter: CharacterType;
  stats: UserStats;
  onBack?: () => void;
  isFriend?: boolean;
  onToggleFriend?: () => void;
  onFreePuff?: () => void;
  freePuffCount?: number;
}) {
  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontSize: 15, color: colors.textSecondary, cursor: 'pointer', padding: 0 }}
        >
          ← 返回
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {onBack && <AvatarBubble character={avatarCharacter} size={36} />}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
            {onBack ? `📊 ${nickname} 的放空紀錄` : '📊 我的放空紀錄'}
          </h1>
        </div>
        {onBack && onToggleFriend && (
          <button
            onClick={onToggleFriend}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: radius.pill,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: isFriend ? colors.surfaceMuted : colors.lavender,
              color: isFriend ? colors.textSecondary : colors.textOnColor,
            }}
          >
            {isFriend ? '移除好友' : '+ 加好友'}
          </button>
        )}
      </div>

      {/* 等級／稱號：依累積放空次數計算，自己跟朋友的頁面都會顯示 */}
      {(() => {
        const levelInfo = computeLevelInfo(stats.totalRestCount);
        return (
          <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <span
              style={{
                background: colors.mintGreen,
                borderRadius: 999,
                padding: '4px 12px',
                fontSize: 14,
                fontWeight: 700,
                color: colors.textPrimary,
                flexShrink: 0,
              }}
            >
              Lv.{levelInfo.level}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>{levelInfo.title}</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{levelInfo.note}</div>
            </div>
          </Card>
        );
      })()}

      {/* 肺部圖示：累積放空次數越多，肺會越黑（放大顯示） */}
      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm, textAlign: 'center' }}>
        <LungIcon totalRestCount={stats.totalRestCount} size={180} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>肺部狀態</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            累積放空 {stats.totalRestCount} 次，抽越多肺會越黑喔
          </div>
        </div>

        {/* 只有在看朋友的頁面時才會出現：免費的給你抽啦 */}
        {onBack && onFreePuff && (
          <button
            onClick={onFreePuff}
            disabled={!freePuffCount || freePuffCount <= 0}
            style={{
              width: '100%',
              marginTop: spacing.xs,
              padding: '10px 0',
              borderRadius: radius.pill,
              border: 'none',
              background: freePuffCount && freePuffCount > 0 ? '#2B2B33' : colors.surfaceMuted,
              color: freePuffCount && freePuffCount > 0 ? '#FFFFFF' : colors.textSecondary,
              fontWeight: 600,
              fontSize: 13,
              cursor: freePuffCount && freePuffCount > 0 ? 'pointer' : 'default',
            }}
          >
            🚬 免費的給你抽啦 {freePuffCount ? `x${freePuffCount}` : ''}
          </button>
        )}
      </Card>

      {/* 今日 / 本月 / 累積休息次數：今日、本月都是即時從開抽時間戳記算出來的 */}
      {(() => {
        const { today, month } = computeTodayAndMonthCounts(stats.puffTimestamps ?? []);
        return (
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <Card style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: colors.textSecondary }}>今日休息</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>{today} 次</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: colors.textSecondary }}>本月休息</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>{month} 次</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: colors.textSecondary }}>累積休息</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>{stats.totalRestCount} 次</div>
            </Card>
          </div>
        );
      })()}

      {/* 累積二手菸：被別人用「免費菸」請過幾次，跟自己抽的完全分開算 */}
      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>🚬 累積二手菸</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>被朋友請客抽掉的，不算在自己頭上</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>{stats.secondhandCount ?? 0} 支</div>
      </Card>

      {/* 買菸花費：累積休息每滿 20 支，就當作花了 100 元買菸 */}
      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>💸 買菸花費</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            每抽滿 {SPEND_PER_STICKS} 支就是 {SPEND_AMOUNT_PER_UNIT} 元
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.danger }}>
          {computeCigaretteSpending(stats.totalRestCount)} 元
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   畫面：通知（小鈴噹）— 誰偷了你、偷了幾隻，什麼時候發生的
   ============================================================ */

function NotificationsScreen({
  notifications,
  onBack,
}: {
  notifications: NotificationEntry[];
  onBack: () => void;
}) {
  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <button
        onClick={onBack}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontSize: 15, color: colors.textSecondary, cursor: 'pointer', padding: 0 }}
      >
        ← 返回
      </button>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>🔔 通知</h1>

      {notifications.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
          目前還沒有任何通知
        </div>
      )}

      {notifications.map((n, idx) => (
        <Card
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing.sm,
            background: n.read ? colors.surface : colors.surfaceMuted,
          }}
        >
          <div style={{ fontSize: 28 }}>
            {n.kind === 'stolen' ? '🕵️' : n.kind === 'robbed' ? '🤕' : n.kind === 'force_puffed' ? '🚬' : '🥺'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.5 }}>
              {n.kind === 'stolen' && (
                <>
                  小偷 <strong>{n.from}</strong> 偷走了你 <strong style={{ color: colors.danger }}>{n.amount}</strong> 隻呼吸棒，真是個可憐的菸蟲
                </>
              )}
              {n.kind === 'robbed' && (
                <>
                  <strong>{n.from}</strong>：「把錢拿來讓我去治病」搶走了你 <strong style={{ color: colors.danger }}>{n.amount}</strong> 元
                </>
              )}
              {n.kind === 'force_puffed' && (
                <>
                  <strong>{n.from}</strong>：免費的給你抽啦！
                </>
              )}
              {n.kind === 'friend_puffing' && (
                <>
                  <strong>{n.from}</strong> 又在抽了，他真的很可憐🥺
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{n.date}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   畫面：排行榜 — 看自己跟所有好友的累積休息次數，比誰抽最多
   ============================================================ */

interface LeaderboardEntry {
  nickname: string;
  avatarCharacter: CharacterType;
  totalRestCount: number;
  isMe: boolean;
}

const RANK_MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function LeaderboardScreen({
  entries,
  loading,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
}) {
  const sorted = [...entries].sort((a, b) => b.totalRestCount - a.totalRestCount);

  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>🏆 排行榜</h1>
      <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: -8 }}>比比看，你跟好友誰抽最多</div>

      {loading && <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>載入中…</div>}

      {!loading && sorted.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
          還沒有資料，先去加幾個好友吧
        </div>
      )}

      {!loading &&
        sorted.map((entry, idx) => (
          <Card
            key={entry.nickname}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
              border: entry.isMe ? `2px solid ${colors.lavender}` : undefined,
            }}
          >
            <div style={{ width: 28, textAlign: 'center', fontSize: idx < 3 ? 22 : 15, fontWeight: 700, color: colors.textSecondary }}>
              {RANK_MEDAL[idx] ?? idx + 1}
            </div>
            <AvatarBubble character={entry.avatarCharacter} size={44} status="online" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
                {entry.nickname}
                {entry.isMe && <span style={{ color: colors.lavender }}>（我）</span>}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{entry.totalRestCount} 次</div>
          </Card>
        ))}
    </div>
  );
}

/* ============================================================
   底部導覽列
   ============================================================ */

function BottomTabBar({
  active,
  onChange,
}: {
  active: 'home' | 'goodkid' | 'leaderboard' | 'stats';
  onChange: (tab: 'home' | 'goodkid' | 'leaderboard' | 'stats') => void;
}) {
  const tabs: { key: 'home' | 'goodkid' | 'leaderboard' | 'stats'; label: string; icon: string }[] = [
    { key: 'home', label: '首頁', icon: '🏠' },
    { key: 'goodkid', label: '小遊戲', icon: '🧸' },
    { key: 'leaderboard', label: '排行', icon: '🏆' },
    { key: 'stats', label: '個人檔案', icon: '📊' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        background: colors.surface,
        borderTop: `1px solid ${colors.surfaceMuted}`,
        padding: `${spacing.xs}px 0`,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            color: active === tab.key ? colors.lavender : colors.textSecondary,
            fontSize: 12,
          }}
        >
          <span style={{ fontSize: 18 }}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   簡易帳號系統 — 沒有密碼，純粹用「暱稱」當 key
   資料存在共用的雲端資料庫（/api/account），大家共用同一份資料庫，
   只是每個暱稱各自有自己的一份紀錄。
   ============================================================ */

async function fetchAccount(nickname: string): Promise<AccountRecord | null> {
  try {
    const res = await fetch(`/api/account?nickname=${encodeURIComponent(nickname)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data as AccountRecord) ?? null;
  } catch {
    return null;
  }
}

async function saveAccount(nickname: string, record: AccountRecord): Promise<void> {
  try {
    await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, record }),
    });
  } catch {
    // 存檔失敗先忽略，不影響當下操作；下次資料變動時還會再存一次
  }
}

// 呼吸小偷：去某個朋友的背包裡隨機偷走 1 ~ 50 隻呼吸棒（受限於對方實際擁有的數量）
// 回傳實際偷到的內容（每款偷了幾隻），並且會直接把朋友那邊的背包扣掉、
// 存一筆「被偷通知」進對方帳號，再一起存回雲端
async function stealSticksFromFriend(
  friendNickname: string,
  minSteal: number,
  maxSteal: number,
  thiefNickname: string
): Promise<{ success: boolean; stolen: Record<string, number> }> {
  const friendAccount = await fetchAccount(friendNickname);
  if (!friendAccount) return { success: false, stolen: {} };

  // 把朋友背包裡每一隻呼吸棒都攤開成一個「池子」，方便隨機抽
  const pool: string[] = [];
  for (const [skinId, qty] of Object.entries(friendAccount.quantities)) {
    for (let i = 0; i < qty; i++) pool.push(skinId);
  }
  // 洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const targetAmount = Math.floor(minSteal + Math.random() * (maxSteal - minSteal + 1));
  const takenIds = pool.slice(0, Math.min(targetAmount, pool.length));

  const stolen: Record<string, number> = {};
  for (const id of takenIds) stolen[id] = (stolen[id] ?? 0) + 1;

  const newFriendQuantities = { ...friendAccount.quantities };
  for (const [id, count] of Object.entries(stolen)) {
    newFriendQuantities[id] = Math.max(0, (newFriendQuantities[id] ?? 0) - count);
  }

  const totalStolen = Object.values(stolen).reduce((a, b) => a + b, 0);
  // 只有真的偷到東西才發通知給對方
  const newNotifications =
    totalStolen > 0
      ? [
          { kind: 'stolen' as const, from: thiefNickname, amount: totalStolen, date: formatDateTime(new Date()), read: false },
          ...(friendAccount.notifications ?? []),
        ].slice(0, 50)
      : friendAccount.notifications ?? [];

  await saveAccount(friendNickname, {
    ...friendAccount,
    quantities: newFriendQuantities,
    notifications: newNotifications,
  });
  return { success: true, stolen };
}

// 呼吸券：搶朋友的錢，一次搶 100 ~ 200 元之間（受限於對方實際餘額，不會搶到負的）
// 會直接扣掉對方的零錢包、留一筆通知進對方帳號，再一起存回雲端
async function robCoinsFromFriend(
  friendNickname: string,
  minAmount: number,
  maxAmount: number,
  robberNickname: string
): Promise<{ success: boolean; robbedAmount: number }> {
  const friendAccount = await fetchAccount(friendNickname);
  if (!friendAccount) return { success: false, robbedAmount: 0 };

  const friendCoins = friendAccount.coins ?? 0;
  const targetAmount = Math.floor(minAmount + Math.random() * (maxAmount - minAmount + 1));
  const robbedAmount = Math.min(targetAmount, friendCoins);

  const newNotifications =
    robbedAmount > 0
      ? [
          { kind: 'robbed' as const, from: robberNickname, amount: robbedAmount, date: formatDateTime(new Date()), read: false },
          ...(friendAccount.notifications ?? []),
        ].slice(0, 50)
      : friendAccount.notifications ?? [];

  await saveAccount(friendNickname, {
    ...friendAccount,
    coins: friendCoins - robbedAmount,
    notifications: newNotifications,
  });
  return { success: true, robbedAmount };
}

// 免費的給你抽啦：硬請朋友抽一支。只會讓對方的「累積二手菸」+1，
// 不影響他自己的累積放空次數、肺部黑化、等級或今日／本月統計。
async function forcePuffFriend(friendNickname: string, giverNickname: string): Promise<{ success: boolean; newSecondhand: number }> {
  const friendAccount = await fetchAccount(friendNickname);
  if (!friendAccount) return { success: false, newSecondhand: 0 };

  const newSecondhand = (friendAccount.stats.secondhandCount ?? 0) + 1;

  const newNotifications = [
    { kind: 'force_puffed' as const, from: giverNickname, date: formatDateTime(new Date()), read: false },
    ...(friendAccount.notifications ?? []),
  ].slice(0, 50);

  await saveAccount(friendNickname, {
    ...friendAccount,
    stats: { ...friendAccount.stats, secondhandCount: newSecondhand },
    notifications: newNotifications,
  });
  return { success: true, newSecondhand };
}

// 加好友時：把「我」加進對方帳號的 watchers 清單，這樣對方開抽時才知道要通知我
async function addWatcherToAccount(targetNickname: string, watcherNickname: string): Promise<void> {
  const targetAccount = await fetchAccount(targetNickname);
  if (!targetAccount) return;
  const currentWatchers = targetAccount.watchers ?? [];
  if (currentWatchers.includes(watcherNickname)) return;
  await saveAccount(targetNickname, { ...targetAccount, watchers: [...currentWatchers, watcherNickname] });
}

// 移除好友時：把「我」從對方帳號的 watchers 清單移除，對方開抽就不會再通知我
async function removeWatcherFromAccount(targetNickname: string, watcherNickname: string): Promise<void> {
  const targetAccount = await fetchAccount(targetNickname);
  if (!targetAccount) return;
  const currentWatchers = targetAccount.watchers ?? [];
  if (!currentWatchers.includes(watcherNickname)) return;
  await saveAccount(targetNickname, { ...targetAccount, watchers: currentWatchers.filter((w) => w !== watcherNickname) });
}

// 開抽的當下，通知所有把我加為好友的人（watchers）：「XXX 又在抽了，他真的很可憐🥺」
async function notifyWatchersOfPuff(watcherNicknames: string[], puffingNickname: string): Promise<void> {
  const dateLabel = formatDateTime(new Date());
  await Promise.all(
    watcherNicknames.map(async (watcherName) => {
      const watcherAccount = await fetchAccount(watcherName);
      if (!watcherAccount) return;
      const newNotifications = [
        { kind: 'friend_puffing' as const, from: puffingNickname, date: dateLabel, read: false },
        ...(watcherAccount.notifications ?? []),
      ].slice(0, 50);
      await saveAccount(watcherName, { ...watcherAccount, notifications: newNotifications });
    })
  );
}

function NicknameScreen({ onConfirm }: { onConfirm: (nickname: string, avatarCharacter: CharacterType) => void }) {
  const [nameInput, setNameInput] = useState('');
  const [avatar, setAvatar] = useState<CharacterType>('cat');
  const [submitting, setSubmitting] = useState(false);
  const characterOptions: CharacterType[] = ['cat', 'panda', 'fox', 'rabbit'];

  const handleSubmit = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    onConfirm(trimmed, avatar);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <div style={{ fontSize: 48 }}>☁️</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>歡迎來到 Cloud Puff</h1>
      <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
        取一個暱稱就能開始，之後在這台裝置打開會自動記得你
      </div>

      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
        {characterOptions.map((c) => (
          <button
            key={c}
            onClick={() => setAvatar(c)}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: avatar === c ? `2px solid ${colors.lavender}` : '2px solid transparent',
              background: colors.surfaceMuted,
              fontSize: 26,
              cursor: 'pointer',
            }}
          >
            {CHARACTER_EMOJI[c]}
          </button>
        ))}
      </div>

      <input
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        placeholder="輸入你的暱稱"
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '14px 16px',
          borderRadius: radius.input,
          border: `1px solid ${colors.surfaceMuted}`,
          fontSize: 15,
          outline: 'none',
          marginTop: spacing.md,
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={!nameInput.trim() || submitting}
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '14px 0',
          borderRadius: radius.pill,
          border: 'none',
          background: colors.lavender,
          color: colors.textOnColor,
          fontWeight: 600,
          fontSize: 15,
          cursor: nameInput.trim() ? 'pointer' : 'default',
          opacity: nameInput.trim() ? 1 : 0.5,
          marginTop: spacing.sm,
        }}
      >
        {submitting ? '進入中…' : '開始放空'}
      </button>
    </div>
  );
}

/* ============================================================
   主 App 元件（狀態切換取代路由，全部包在同一個檔案裡）
   ============================================================ */

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [activeTab, setActiveTab] = useState<'home' | 'goodkid' | 'leaderboard' | 'stats'>('home');
  const [lastDuration, setLastDuration] = useState(0);

  // 帳號狀態：nickname 為 null 代表還沒登入，先顯示輸入暱稱畫面
  const [nickname, setNickname] = useState<string | null>(null);
  const [accountReady, setAccountReady] = useState(false); // 雲端資料是否已經載入完成
  const [avatarCharacter, setAvatarCharacter] = useState<CharacterType>('cat');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [myStats, setMyStats] = useState<UserStats>(STARTER_STATS);
  const [coins, setCoins] = useState<number>(STARTER_COINS);
  const [tools, setTools] = useState<Record<string, number>>({}); // 特殊道具庫存，例如呼吸小偷
  const breathThiefCount = tools[TOOL_BREATH_THIEF] ?? 0;
  const breathVoucherCount = tools[TOOL_BREATH_VOUCHER] ?? 0;
  const freePuffCount = tools[TOOL_FREE_PUFF] ?? 0;
  const [myComments, setMyComments] = useState<CommentEntry[]>([]); // 別人留在我放空紀錄下面的留言
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]); // 收到的通知：被偷、被搶、好友開抽
  const [watchers, setWatchers] = useState<string[]>([]); // 誰把我加為好友了（我開抽時要通知這些人）
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // 記錄這次「開抽」是什麼時候按下去的，抽完之後歷史紀錄要顯示這個開抽時間
  const puffStartTimeRef = useRef<Date | null>(null);

  // 好友頁面現在存整個帳號資料（含留言、庫存），這樣留言／偷竊才能直接改好存回去
  const [friendRecord, setFriendRecord] = useState<{ nickname: string; record: AccountRecord } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 已加的好友暱稱清單，以及每個好友的頭像快取（用來在首頁直接顯示頭像，不用每次都重新查）
  const [friends, setFriends] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, CharacterType | null>>({});

  // 排行榜：自己 + 所有好友的累積休息次數，每次打開排行榜都重新抓一次最新的
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // 呼吸棒的外觀是固定的，只有「這個帳號各款式的庫存數量」是動態的
  const skins: SkinData[] = mockSkins.map((s) => ({ ...s, quantity: quantities[s.id] ?? 0 }));

  const levelInfo = computeLevelInfo(myStats.totalRestCount);
  const displayUser: UserData = {
    id: nickname ?? 'me',
    nickname: nickname ?? '',
    avatarCharacter,
    level: levelInfo.level,
    exp: levelInfo.progress,
    expToNextLevel: 100,
    title: `${levelInfo.title}（${levelInfo.note}）`,
    onlineStatus: 'online',
    equippedSkin: '',
  };

  // 打開網頁時，如果這台裝置記得暱稱，就自動用那個暱稱去雲端把資料抓回來
  useEffect(() => {
    const savedNickname = typeof window !== 'undefined' ? window.localStorage.getItem('cloudpuff_nickname') : null;
    if (savedNickname) {
      (async () => {
        const record = await fetchAccount(savedNickname);
        if (record) {
          setAvatarCharacter(record.avatarCharacter);
          setQuantities(record.quantities);
          setMyStats(migrateStatsToTimeSystem(record.stats));
          setFriends(record.friends ?? []);
          setCoins(record.coins ?? STARTER_COINS);
          setTools(record.tools ?? {});
          setMyComments(record.comments ?? []);
          setNotifications(record.notifications ?? []);
          setWatchers(record.watchers ?? []);
        } else {
          setAvatarCharacter('cat');
          setQuantities(STARTER_QUANTITIES);
          setMyStats(STARTER_STATS);
          setFriends([]);
          setCoins(STARTER_COINS);
          setTools({});
          setMyComments([]);
          setNotifications([]);
          setWatchers([]);
        }
        setNickname(savedNickname);
        setAccountReady(true);
      })();
    }
  }, []);

  // 資料有變動（背包庫存、放空紀錄、頭像、好友清單、零錢包、道具、收到的留言、通知）就自動存回雲端資料庫，
  // 這樣其他人用你的暱稱查詢時，看到的才是最新的
  useEffect(() => {
    if (!nickname || !accountReady) return;
    saveAccount(nickname, {
      avatarCharacter,
      quantities,
      stats: myStats,
      friends,
      coins,
      tools,
      comments: myComments,
      notifications,
      watchers,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantities, myStats, avatarCharacter, friends, coins, tools, myComments, notifications, watchers, nickname, accountReady]);

  // 輸入暱稱畫面按下「開始放空」：如果這個暱稱雲端已經有資料就直接讀取，沒有的話幫他建一個新帳號
  const handleCreateAccount = async (name: string, avatar: CharacterType) => {
    const existing = await fetchAccount(name);
    if (existing) {
      setAvatarCharacter(existing.avatarCharacter);
      setQuantities(existing.quantities);
      setMyStats(migrateStatsToTimeSystem(existing.stats));
      setFriends(existing.friends ?? []);
      setCoins(existing.coins ?? STARTER_COINS);
      setTools(existing.tools ?? {});
      setMyComments(existing.comments ?? []);
      setNotifications(existing.notifications ?? []);
      setWatchers(existing.watchers ?? []);
    } else {
      setAvatarCharacter(avatar);
      setQuantities(STARTER_QUANTITIES);
      setMyStats(STARTER_STATS);
      setFriends([]);
      setCoins(STARTER_COINS);
      setTools({});
      setMyComments([]);
      setNotifications([]);
      setWatchers([]);
      await saveAccount(name, {
        avatarCharacter: avatar,
        quantities: STARTER_QUANTITIES,
        stats: STARTER_STATS,
        friends: [],
        coins: STARTER_COINS,
        tools: {},
        comments: [],
        notifications: [],
        watchers: [],
      });
    }
    window.localStorage.setItem('cloudpuff_nickname', name);
    setNickname(name);
    setAccountReady(true);
  };

  // 好友清單有變動時，把還沒抓過頭像的好友抓一次資料，快取起來讓首頁能直接顯示頭像
  useEffect(() => {
    const missing = friends.filter((f) => !(f in friendProfiles));
    if (missing.length === 0) return;
    (async () => {
      const results = await Promise.all(
        missing.map(async (f) => {
          const record = await fetchAccount(f);
          return [f, record ? record.avatarCharacter : null] as const;
        })
      );
      setFriendProfiles((prev) => {
        const next = { ...prev };
        for (const [name, avatar] of results) next[name] = avatar;
        return next;
      });
    })();
  }, [friends, friendProfiles]);

  const handleStartPuff = () => setScreen('puffroom');

  // 一選定呼吸棒（鎖定、開始抽）就立刻生效：背包那隻 -1、今日/本月/累積休息次數各 +1
  // 同時記錄下這次「開抽」的時間，抽完後歷史紀錄要顯示這個時間
  const handleConfirmSkin = (skinId: string) => {
    const now = new Date();
    puffStartTimeRef.current = now;
    setQuantities((prev) => ({ ...prev, [skinId]: Math.max(0, (prev[skinId] ?? 0) - 1) }));
    setMyStats((prev) => ({
      ...prev,
      totalRestCount: prev.totalRestCount + 1,
      puffTimestamps: [now.toISOString(), ...(prev.puffTimestamps ?? [])].slice(0, 500),
    }));
    // 只要開抽就送一張免費菸（不用抽完）
    setTools((prev) => ({ ...prev, [TOOL_FREE_PUFF]: (prev[TOOL_FREE_PUFF] ?? 0) + 1 }));
    // 通知所有把我加為好友的人：我開抽了
    if (nickname && watchers.length > 0) {
      notifyWatchersOfPuff(watchers, nickname);
    }
  };

  // 真的抽完（燒完一支）：只補上這次的歷史紀錄，次數已經在選呼吸棒當下算過了，這裡不重複加
  // 歷史紀錄的時間用「開抽當下」的時間，不是燒完的時間
  const handlePuffFinished = (durationSeconds: number) => {
    setLastDuration(durationSeconds);
    setScreen('result');

    const startTime = puffStartTimeRef.current ?? new Date();
    const dateLabel = formatDateTime(startTime);
    const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, '0');
    const seconds = String(durationSeconds % 60).padStart(2, '0');
    setMyStats((prev) => ({
      ...prev,
      history: [{ date: dateLabel, withWho: '獨自放空', duration: `${minutes}:${seconds}` }, ...prev.history].slice(0, 20),
    }));
    // 完整抽完一整隻呼吸棒，獎勵一張呼吸券
    setTools((prev) => ({ ...prev, [TOOL_BREATH_VOUCHER]: (prev[TOOL_BREATH_VOUCHER] ?? 0) + 1 }));
    setToastMessage('抽完了！獲得一張呼吸券 🎫');
    puffStartTimeRef.current = null;
  };

  const handleExitRoom = () => {
    setScreen('home');
    setActiveTab('home');
  };
  const handleReplay = () => setScreen('puffroom');
  const handleBackHome = () => {
    setScreen('home');
    setActiveTab('home');
  };
  const handleTabChange = (tab: 'home' | 'goodkid' | 'leaderboard' | 'stats') => {
    if (tab === 'leaderboard') {
      handleGoLeaderboard();
      return;
    }
    setActiveTab(tab);
    setScreen(tab);
  };
  const handleGoShop = () => setScreen('shop');
  const handleGoBackpack = () => setScreen('backpack');
  // 打開通知頁：進去看的當下，把目前的通知都標記為已讀
  const handleGoNotifications = () => {
    setScreen('notifications');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };
  // 打開排行榜：把自己跟所有好友的最新累積休息次數都抓一次
  const handleGoLeaderboard = async () => {
    setActiveTab('leaderboard');
    setScreen('leaderboard');
    setLeaderboardLoading(true);
    const friendResults = await Promise.all(
      friends.map(async (f) => {
        const record = await fetchAccount(f);
        return record
          ? { nickname: f, avatarCharacter: record.avatarCharacter, totalRestCount: record.stats.totalRestCount, isMe: false }
          : null;
      })
    );
    const me: LeaderboardEntry = {
      nickname: nickname ?? '',
      avatarCharacter,
      totalRestCount: myStats.totalRestCount,
      isMe: true,
    };
    setLeaderboardEntries([me, ...friendResults.filter((e): e is LeaderboardEntry => e !== null)]);
    setLeaderboardLoading(false);
  };
  // 商城每買一次要花 SHOP_PRICE 元（用零錢包的錢付），成功的話直接進 20 隻到背包
  const handlePurchase = (skinId: string) => {
    if (coins < SHOP_PRICE) {
      setToastMessage('零錢包餘額不足，去玩「我是好寶寶」賺點錢吧');
      return;
    }
    setCoins((prev) => prev - SHOP_PRICE);
    setQuantities((prev) => ({ ...prev, [skinId]: (prev[skinId] ?? 0) + 20 }));
  };
  // 商城買一個呼吸小偷道具，要花 BREATH_THIEF_PRICE 元
  const handleBuyBreathThief = () => {
    if (coins < BREATH_THIEF_PRICE) {
      setToastMessage('零錢包餘額不足');
      return;
    }
    setCoins((prev) => prev - BREATH_THIEF_PRICE);
    setTools((prev) => ({ ...prev, [TOOL_BREATH_THIEF]: (prev[TOOL_BREATH_THIEF] ?? 0) + 1 }));
  };
  // 小遊戲「我是好寶寶」每撿一隻呼吸棒，零錢包就 +amount 元
  const handleEarnCoin = (amount: number) => {
    setCoins((prev) => prev + amount);
  };

  // 輸入朋友暱稱查看他的放空紀錄：直接去共用的雲端資料庫用暱稱找（點好友頭像也是走這個）
  const handleSearchFriend = async (searchName: string) => {
    setToastMessage(null);
    const record = await fetchAccount(searchName);
    if (record) {
      setFriendRecord({ nickname: searchName, record: { ...record, stats: migrateStatsToTimeSystem(record.stats) } });
      setScreen('friend');
    } else {
      setToastMessage(`找不到暱稱「${searchName}」的放空紀錄，對方可能還沒開始玩`);
    }
  };
  const handleBackFromFriend = () => {
    setFriendRecord(null);
    setScreen('home');
    setActiveTab('home');
  };

  // 加好友：確認這個暱稱真的存在才加進清單，避免加到打錯字的名字
  const handleAddFriend = async (name: string) => {
    setToastMessage(null);
    if (name === nickname) {
      setToastMessage('不能把自己加成好友喔');
      return;
    }
    if (friends.includes(name)) {
      setToastMessage(`「${name}」已經在好友清單裡了`);
      return;
    }
    const record = await fetchAccount(name);
    if (!record) {
      setToastMessage(`找不到暱稱「${name}」，對方可能還沒開始玩`);
      return;
    }
    setFriends((prev) => [...prev, name]);
    setFriendProfiles((prev) => ({ ...prev, [name]: record.avatarCharacter }));
    if (nickname) addWatcherToAccount(name, nickname);
  };

  const handleRemoveFriend = (name: string) => {
    setFriends((prev) => prev.filter((f) => f !== name));
    if (nickname) removeWatcherFromAccount(name, nickname);
  };

  // 在好友的放空紀錄頁按「加好友／移除好友」
  const handleToggleFriend = () => {
    if (!friendRecord) return;
    if (friends.includes(friendRecord.nickname)) {
      handleRemoveFriend(friendRecord.nickname);
    } else {
      setFriends((prev) => [...prev, friendRecord.nickname]);
      setFriendProfiles((prev) => ({ ...prev, [friendRecord.nickname]: friendRecord.record.avatarCharacter }));
      if (nickname) addWatcherToAccount(friendRecord.nickname, nickname);
    }
  };

  // 在背包使用呼吸小偷：選一個朋友，隨機偷走他 1～50 隻呼吸棒，偷到的直接進自己背包，
  // 同時會在對方帳號留下一筆通知，讓他知道是誰偷的、偷了幾隻
  const handleUseBreathThief = async (targetNickname: string) => {
    if (breathThiefCount <= 0) {
      setToastMessage('沒有呼吸小偷了，先去商城買一個');
      return;
    }
    if (!nickname) return;
    setTools((prev) => ({ ...prev, [TOOL_BREATH_THIEF]: Math.max(0, (prev[TOOL_BREATH_THIEF] ?? 0) - 1) }));
    const result = await stealSticksFromFriend(targetNickname, BREATH_THIEF_MIN_STEAL, BREATH_THIEF_MAX_STEAL, nickname);
    if (!result.success) {
      setToastMessage(`偷竊失敗，找不到「${targetNickname}」的帳號`);
      return;
    }
    const totalStolen = Object.values(result.stolen).reduce((a, b) => a + b, 0);
    if (totalStolen > 0) {
      setQuantities((prev) => {
        const next = { ...prev };
        for (const [id, count] of Object.entries(result.stolen)) {
          next[id] = (next[id] ?? 0) + count;
        }
        return next;
      });
      setToastMessage(`偷到了 ${totalStolen} 隻呼吸棒！`);
    } else {
      setToastMessage(`${targetNickname} 的背包是空的，什麼都沒偷到`);
    }
  };

  // 在背包使用呼吸券：選一個朋友，搶走他 100～200 元，搶到的直接進自己零錢包，
  // 同時會在對方帳號留下一筆通知：「OOO：把錢拿來讓我去治病」
  const handleUseBreathVoucher = async (targetNickname: string) => {
    if (breathVoucherCount <= 0) {
      setToastMessage('沒有呼吸券了，抽完一整支呼吸棒才會拿到');
      return;
    }
    if (!nickname) return;
    setTools((prev) => ({ ...prev, [TOOL_BREATH_VOUCHER]: Math.max(0, (prev[TOOL_BREATH_VOUCHER] ?? 0) - 1) }));
    const result = await robCoinsFromFriend(targetNickname, ROB_MIN_AMOUNT, ROB_MAX_AMOUNT, nickname);
    if (!result.success) {
      setToastMessage(`搶劫失敗，找不到「${targetNickname}」的帳號`);
      return;
    }
    if (result.robbedAmount > 0) {
      setCoins((prev) => prev + result.robbedAmount);
      setToastMessage(`搶到了 ${result.robbedAmount} 元！`);
    } else {
      setToastMessage(`${targetNickname} 的零錢包是空的，什麼都沒搶到`);
    }
  };

  // 免費的給你抽啦：消耗一張免費菸，硬請朋友抽一支，對方累積放空次數 +1 並收到通知
  const handleFreePuffFriend = async (targetNickname: string) => {
    if (freePuffCount <= 0) {
      setToastMessage('沒有免費菸了，開抽一次就會拿到一張');
      return;
    }
    if (!nickname) return;
    setTools((prev) => ({ ...prev, [TOOL_FREE_PUFF]: Math.max(0, (prev[TOOL_FREE_PUFF] ?? 0) - 1) }));
    const result = await forcePuffFriend(targetNickname, nickname);
    if (!result.success) {
      setToastMessage(`請客失敗，找不到「${targetNickname}」的帳號`);
      return;
    }
    setFriendRecord((prev) =>
      prev && prev.nickname === targetNickname
        ? { ...prev, record: { ...prev.record, stats: { ...prev.record.stats, secondhandCount: result.newSecondhand } } }
        : prev
    );
    setToastMessage(`請 ${targetNickname} 抽了一支 🚬`);
  };

  // 還沒登入：先顯示輸入暱稱畫面
  if (!nickname) {
    return <NicknameScreen onConfirm={handleCreateAccount} />;
  }

  // 已經記得暱稱，但雲端資料還在載入中
  if (!accountReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, color: colors.textSecondary }}>
        載入中…
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100vh',
        background: colors.background,
        fontFamily:
          '"Nunito", "Baloo 2", "PingFang TC", "Noto Sans TC", -apple-system, sans-serif',
        position: 'relative',
      }}
    >
      {screen === 'home' && (
        <HomeScreen
          user={displayUser}
          coins={coins}
          unreadNotificationCount={unreadNotificationCount}
          onStartPuff={handleStartPuff}
          onGoShop={handleGoShop}
          onGoBackpack={handleGoBackpack}
          onGoNotifications={handleGoNotifications}
          onViewFriend={handleSearchFriend}
          onAddFriend={handleAddFriend}
          friends={friends}
          friendProfiles={friendProfiles}
          skins={skins}
        />
      )}
      {screen === 'backpack' && (
        <BackpackScreen
          skins={skins}
          friends={friends}
          breathThiefCount={breathThiefCount}
          onUseBreathThief={handleUseBreathThief}
          breathVoucherCount={breathVoucherCount}
          onUseBreathVoucher={handleUseBreathVoucher}
          freePuffCount={freePuffCount}
          onUseFreePuff={handleFreePuffFriend}
          onBack={handleBackHome}
          onGoShop={handleGoShop}
        />
      )}
      {screen === 'stats' && (
        <StatsScreen
          nickname={displayUser.nickname}
          avatarCharacter={avatarCharacter}
          stats={myStats}
        />
      )}
      {screen === 'friend' && friendRecord && (
        <StatsScreen
          nickname={friendRecord.nickname}
          avatarCharacter={friendRecord.record.avatarCharacter}
          stats={friendRecord.record.stats}
          onBack={handleBackFromFriend}
          isFriend={friends.includes(friendRecord.nickname)}
          onToggleFriend={handleToggleFriend}
          onFreePuff={() => handleFreePuffFriend(friendRecord.nickname)}
          freePuffCount={freePuffCount}
        />
      )}
      {screen === 'shop' && (
        <ShopScreen
          skins={skins}
          coins={coins}
          breathThiefCount={breathThiefCount}
          onPurchase={handlePurchase}
          onBuyBreathThief={handleBuyBreathThief}
          onBack={handleBackHome}
        />
      )}
      {screen === 'goodkid' && <GoodKidGameScreen coins={coins} onEarnCoin={handleEarnCoin} />}
      {screen === 'leaderboard' && (
        <LeaderboardScreen entries={leaderboardEntries} loading={leaderboardLoading} />
      )}
      {screen === 'notifications' && (
        <NotificationsScreen notifications={notifications} onBack={handleBackHome} />
      )}
      {screen === 'puffroom' && (
        <PuffRoomScreen
          user={displayUser}
          skins={skins}
          onConfirmSkin={handleConfirmSkin}
          onFinished={handlePuffFinished}
          onExit={handleExitRoom}
        />
      )}
      {screen === 'result' && <ResultScreen durationSeconds={lastDuration} onReplay={handleReplay} onBackHome={handleBackHome} />}

      {(screen === 'home' || screen === 'goodkid' || screen === 'leaderboard' || screen === 'stats') && (
        <BottomTabBar active={activeTab} onChange={handleTabChange} />
      )}

      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.textPrimary,
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: radius.pill,
            fontSize: 13,
            maxWidth: '90%',
            textAlign: 'center',
            zIndex: 10,
          }}
          onClick={() => setToastMessage(null)}
        >
          {toastMessage}
        </div>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          background: ${colors.background};
        }
      `}</style>
    </div>
  );
}
