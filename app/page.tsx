'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================
   Cloud Puff ☁️ — Web 單檔元件版（第二版）
   直接把這個檔案放到 Next.js 專案的 app/page.tsx（或任一 page）
   即可部署到 Vercel。全部邏輯、樣式、假資料都包在同一個檔案裡，
   使用 styled-jsx（Next.js 內建，免安裝）做動畫與樣式。

   本版新增：
   1. 放空紀錄頁加入「肺部圖示」（抽越多、肺越黑）
      + 今日 / 本月 / 累積休息次數
   2. 點好友頭像可以查看好友的完整放空紀錄
   3. 開抽房：長按越久，放開後吐出的雲越多
   4. 首頁新增「商城」，可購買應援棒（目前全面 0 元）
   （放空紀錄 / 好友紀錄目前都是假資料，之後再串接真實資料）
   ============================================================ */

/* ---------------------- 型別 ---------------------- */

type CharacterType = 'panda' | 'cat' | 'fox' | 'rabbit';
type OnlineStatus = 'online' | 'offline' | 'in_room';
type CharacterState = 'idle' | 'inhale' | 'exhale' | 'relaxed';
type ScreenName = 'home' | 'puffroom' | 'result' | 'collection' | 'stats' | 'shop' | 'friend' | 'backpack' | 'goodkid';

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
  todayRestCount: number;
  monthRestCount: number;
  totalRestCount: number;
  history: RestHistoryItem[];
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

/* ---------------------- 假資料 ---------------------- */

// 一個「帳號」在雲端共用資料庫裡存的內容：頭像、背包庫存、放空紀錄
// 沒有密碼、沒有登入驗證，純粹用暱稱當 key 做區分（簡易版帳號系統）
interface AccountRecord {
  avatarCharacter: CharacterType;
  quantities: Record<string, number>; // 每款應援棒的背包庫存，key 是 skin id
  stats: UserStats;
  friends?: string[]; // 已加的好友暱稱清單
  coins?: number; // 零錢包餘額（元），大家都從 0 元開始
}

const mockSkins: SkinData[] = [
  {
    id: 'milktea_white_stick',
    name: '奶茶白應援棒',
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
    name: '粉紅應援棒',
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
    name: '彩虹應援棒',
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
    name: '極光應援棒',
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
    name: '星河應援棒',
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
  todayRestCount: 0,
  monthRestCount: 0,
  totalRestCount: 0,
  history: [],
};

// 全新帳號一開始的零錢包餘額
const STARTER_COINS = 0;

// 商城買一款應援棒（20 隻）要花的錢
const SHOP_PRICE = 200;

// 小遊戲「我是好寶寶」：每撿一隻應援棒進桶子可以賺多少錢
const GOOD_KID_COIN_PER_STICK = 1;
// 遊戲場地上同時會有幾隻應援棒（撿走一隻就會馬上補一隻新的，等於無限生成）
const GOOD_KID_STICK_COUNT = 6;

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
   應援棒元件 — 用來取代寫實菸支的可愛道具（橫向版本）
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

// 累積休息次數達到這個數字時，肺會呈現完全黑化
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
  onStartPuff,
  onGoCollection,
  onGoShop,
  onGoBackpack,
  onGoGoodKid,
  onSearchFriend,
  onViewFriend,
  onAddFriend,
  friends,
  friendProfiles,
  skins,
}: {
  user: UserData;
  coins: number;
  onStartPuff: () => void;
  onGoCollection: () => void;
  onGoShop: () => void;
  onGoBackpack: () => void;
  onGoGoodKid: () => void;
  onSearchFriend: (nickname: string) => void;
  onViewFriend: (nickname: string) => void;
  onAddFriend: (nickname: string) => void;
  friends: string[];
  friendProfiles: Record<string, CharacterType | null>;
  skins: SkinData[];
}) {
  const progress = (user.exp / user.expToNextLevel) * 100;
  const totalStickCount = skins.reduce((sum, s) => sum + s.quantity, 0);
  const [friendInput, setFriendInput] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');

  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      {/* 頂部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>☁️ Cloud Puff</h1>
        <div style={{ display: 'flex', gap: spacing.md, fontSize: 20 }}>
          <button onClick={onGoBackpack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0 }}>
            🎒
          </button>
          <button onClick={onGoShop} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0 }}>
            🛍️
          </button>
          <span>🔔</span>
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

      {/* 主 CTA：背包沒有應援棒的話，按下去改成先去商城兌換 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: `${spacing.xl}px 0`, gap: spacing.xs }}>
        <CloudButton label="開抽" onClick={totalStickCount > 0 ? onStartPuff : onGoShop} />
        {totalStickCount === 0 && (
          <div style={{ fontSize: 12, color: colors.textSecondary }}>背包沒有應援棒了，點一下前往商城兌換</div>
        )}
      </div>

      {/* 小遊戲入口：把地上的應援棒撿進桶子賺零用錢 */}
      <SectionHeader title="🧸 小遊戲" />
      <button
        onClick={onGoGoodKid}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          background: colors.surface,
          borderRadius: radius.card,
          padding: spacing.md,
          boxShadow: cardShadow,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 32 }}>🧸</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>我是好寶寶</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            把地上的應援棒撿進桶子，每撿一隻賺 1 元
          </div>
        </div>
        <div style={{ fontSize: 13, color: colors.lavender, fontWeight: 600 }}>開始 ›</div>
      </button>

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

      {/* 查找：輸入任何暱稱都能查看放空紀錄，不會自動加進好友清單 */}
      <SectionHeader title="查看放空紀錄" />
      <div style={{ display: 'flex', gap: spacing.sm }}>
        <input
          value={friendInput}
          onChange={(e) => setFriendInput(e.target.value)}
          placeholder="輸入暱稱"
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
            if (friendInput.trim()) onSearchFriend(friendInput.trim());
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
          查看
        </button>
      </div>

      {/* 收藏預覽 */}
      <SectionHeader title="我的應援棒收藏" onPressMore={onGoCollection} />
      <div style={{ display: 'flex', gap: spacing.sm }}>
        {skins.slice(0, 5).map((skin) => {
          const owned = skin.quantity > 0;
          return (
            <div
              key={skin.id}
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.card - 8,
                background: owned ? skin.bodyFill : colors.surfaceMuted,
                opacity: owned ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                border: owned ? `4px solid ${skin.handleColor}` : 'none',
              }}
            >
              {owned ? skin.tipEmoji : '🔒'}
            </div>
          );
        })}
      </div>

      {/* 背包預覽：每隻應援棒目前的庫存數量 */}
      <SectionHeader title="🎒 我的背包" onPressMore={onGoBackpack} />
      <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto', paddingBottom: spacing.xs }}>
        {skins.map((skin) => (
          <button
            key={skin.id}
            onClick={onGoBackpack}
            style={{
              flexShrink: 0,
              width: 78,
              background: colors.surface,
              borderRadius: radius.card - 8,
              padding: spacing.sm,
              boxShadow: cardShadow,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
              opacity: skin.quantity > 0 ? 1 : 0.5,
            }}
          >
            <div style={{ fontSize: 22 }}>{skin.tipEmoji}</div>
            <div
              style={{
                fontSize: 11,
                color: colors.textPrimary,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {skin.name}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.lavender, marginTop: 2 }}>x{skin.quantity}</div>
          </button>
        ))}
      </div>

      {/* 商城預覽 */}
      <SectionHeader title="🛍️ 商城" onPressMore={onGoShop} />
      <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto', paddingBottom: spacing.xs }}>
        {skins.slice(0, 4).map((skin) => (
          <button
            key={skin.id}
            onClick={onGoShop}
            style={{
              flexShrink: 0,
              width: 96,
              background: colors.surface,
              borderRadius: radius.card - 8,
              padding: spacing.sm,
              boxShadow: cardShadow,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24 }}>{skin.tipEmoji}</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: colors.textPrimary,
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {skin.name}
            </div>
            <div style={{ fontSize: 12, color: '#5FBF9F', fontWeight: 700, marginTop: 2 }}>{skin.price} 元</div>
          </button>
        ))}
      </div>
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
  // 還沒選應援棒之前是 null：要先選一隻才會真的開始燒
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

  // 階段一：選應援棒（選了就鎖定，不能再換）
  if (!pickedSkinId) {
    return (
      <div style={{ minHeight: '100vh', background: colors.background, paddingBottom: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.sm}px ${spacing.lg}px` }}>
          <button onClick={onExit} style={{ background: 'none', border: 'none', fontSize: 16, color: colors.textPrimary, cursor: 'pointer' }}>
            ← 退出房間
          </button>
        </div>
        <div style={{ padding: `0 ${spacing.lg}px` }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: `0 0 ${spacing.xs}px` }}>選一隻應援棒開始抽</h2>
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

      {/* 目前使用的應援棒（已鎖定，抽完前不能換） */}
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

      {/* 橫向應援棒：握把在左，棒身隨進度從右往左變短（外觀依裝備的收藏款式而定） */}
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
          應援棒剩餘 {Math.round(cigaretteLength)}%　（放著不按約 10 分鐘燒完，長按會加速消耗）
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

      <Card style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ color: colors.textPrimary }}>🏅 獲得成就：夜貓子 x1</div>
        <div style={{ color: colors.textPrimary, marginTop: 4 }}>✨ 好感度 +5（與阿橘）</div>
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
   畫面：收藏頁
   ============================================================ */

function CollectionScreen({ skins }: { skins: SkinData[] }) {
  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, marginBottom: spacing.md }}>☁️ 我的應援棒收藏</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
        {skins.map((skin) => {
          const owned = skin.quantity > 0;
          return (
            <div
              key={skin.id}
              style={{
                background: colors.surface,
                borderRadius: radius.card,
                padding: spacing.md,
                textAlign: 'center',
                boxShadow: cardShadow,
                opacity: owned ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 40, position: 'relative' }}>
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
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginTop: 8 }}>{skin.name}</div>
              <div style={{ fontSize: 13, color: colors.textSecondary }}>
                {owned ? `背包庫存 x${skin.quantity}` : '尚未擁有，去商城兌換'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   小遊戲：我是好寶寶
   地上散落著應援棒，點一下把它撿進桶子裡，每撿一隻零錢包 +1 元。
   應援棒無限生成：撿走一隻，馬上會在別的地方冒出一隻新的。
   ============================================================ */

interface GroundStick {
  id: number;
  x: number; // 在遊戲區內的水平位置（百分比）
  y: number; // 在遊戲區內的垂直位置（百分比）
  collecting: boolean; // 是否正在飛向桶子的動畫中
}

function randomGroundStick(): GroundStick {
  return {
    id: Date.now() + Math.random(),
    x: 10 + Math.random() * 78, // 10% ~ 88%
    y: 8 + Math.random() * 55, // 8% ~ 63%，留空間給下面的桶子
    collecting: false,
  };
}

function GoodKidGameScreen({
  coins,
  onEarnCoin,
  onExit,
}: {
  coins: number;
  onEarnCoin: (amount: number) => void;
  onExit: () => void;
}) {
  const [sticks, setSticks] = useState<GroundStick[]>(() =>
    Array.from({ length: GOOD_KID_STICK_COUNT }).map(() => randomGroundStick())
  );
  const [collectedThisRound, setCollectedThisRound] = useState(0);

  const handlePickStick = (id: number) => {
    setSticks((prev) => prev.map((s) => (s.id === id ? { ...s, collecting: true } : s)));
    onEarnCoin(GOOD_KID_COIN_PER_STICK);
    setCollectedThisRound((c) => c + 1);
    // 飛進桶子的動畫播完後，把這隻換成新的一隻（應援棒無限生成，不會撿完）
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
      }}
    >
      {/* 頂部列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.sm}px ${spacing.lg}px` }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', fontSize: 16, color: colors.textPrimary, cursor: 'pointer' }}>
          ← 離開遊戲
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>🪙 {coins} 元</span>
      </div>

      <div style={{ textAlign: 'center', padding: `0 ${spacing.lg}px` }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' }}>🧸 我是好寶寶</h2>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          點地上的應援棒，把它撿進桶子裡，每撿一隻 +{GOOD_KID_COIN_PER_STICK} 元　本局已撿 {collectedThisRound} 隻
        </div>
      </div>

      {/* 遊戲區：地上散落著應援棒，點了就會飛進畫面下方的桶子 */}
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
              fontSize: 34,
              cursor: s.collecting ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            🪄
          </button>
        ))}

        {/* 桶子：固定在遊戲區下方置中 */}
        <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', fontSize: 48, pointerEvents: 'none' }}>
          🪣
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   畫面：商城 — 每款應援棒 200 元／20 隻，用零錢包的錢購買
   ============================================================ */

function ShopScreen({
  skins,
  coins,
  onPurchase,
  onBack,
}: {
  skins: SkinData[];
  coins: number;
  onPurchase: (skinId: string) => void;
  onBack: () => void;
}) {
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
   畫面：背包 — 顯示每種應援棒目前的庫存數量
   開抽一次會用掉 1 隻；商城買一次會補 20 隻進來。
   ============================================================ */

function BackpackScreen({
  skins,
  onBack,
  onGoShop,
}: {
  skins: SkinData[];
  onBack: () => void;
  onGoShop: () => void;
}) {
  const totalCount = skins.reduce((sum, s) => sum + s.quantity, 0);

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
        目前共有 {totalCount} 隻應援棒，開抽一次會用掉 1 隻
      </div>
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
}: {
  nickname: string;
  avatarCharacter: CharacterType;
  stats: UserStats;
  onBack?: () => void;
  isFriend?: boolean;
  onToggleFriend?: () => void;
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

      {/* 肺部圖示：累積抽越多，肺會越黑 */}
      <Card style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <LungIcon totalRestCount={stats.totalRestCount} size={84} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>肺部狀態</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            累積放空 {stats.totalRestCount} 次，抽越多肺會越黑喔
          </div>
        </div>
      </Card>

      {/* 今日 / 本月 / 累積休息次數 */}
      <div style={{ display: 'flex', gap: spacing.sm }}>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>今日休息</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>{stats.todayRestCount} 次</div>
        </Card>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>本月休息</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>{stats.monthRestCount} 次</div>
        </Card>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>累積休息</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginTop: 4 }}>{stats.totalRestCount} 次</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.sm }}>歷史紀錄</div>
        {stats.history.length === 0 && (
          <div style={{ fontSize: 13, color: colors.textSecondary }}>還沒有任何紀錄</div>
        )}
        {stats.history.map((h, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: idx < stats.history.length - 1 ? `1px solid ${colors.surfaceMuted}` : 'none',
              fontSize: 14,
              color: colors.textPrimary,
            }}
          >
            <span style={{ color: colors.textSecondary }}>{h.date}</span>
            <span>與{h.withWho}</span>
            <span>{h.duration}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   底部導覽列
   ============================================================ */

function BottomTabBar({ active, onChange }: { active: 'home' | 'collection' | 'stats'; onChange: (tab: 'home' | 'collection' | 'stats') => void }) {
  const tabs: { key: 'home' | 'collection' | 'stats'; label: string; icon: string }[] = [
    { key: 'home', label: '首頁', icon: '🏠' },
    { key: 'collection', label: '收藏', icon: '☁️' },
    { key: 'stats', label: '統計', icon: '📊' },
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
  const [activeTab, setActiveTab] = useState<'home' | 'collection' | 'stats'>('home');
  const [lastDuration, setLastDuration] = useState(0);

  // 帳號狀態：nickname 為 null 代表還沒登入，先顯示輸入暱稱畫面
  const [nickname, setNickname] = useState<string | null>(null);
  const [accountReady, setAccountReady] = useState(false); // 雲端資料是否已經載入完成
  const [avatarCharacter, setAvatarCharacter] = useState<CharacterType>('cat');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [myStats, setMyStats] = useState<UserStats>(STARTER_STATS);
  const [coins, setCoins] = useState<number>(STARTER_COINS);

  const [friendRecord, setFriendRecord] = useState<{ nickname: string; avatarCharacter: CharacterType; stats: UserStats } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 已加的好友暱稱清單，以及每個好友的頭像快取（用來在首頁直接顯示頭像，不用每次都重新查）
  const [friends, setFriends] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, CharacterType | null>>({});

  // 應援棒的外觀是固定的，只有「這個帳號各款式的庫存數量」是動態的
  const skins: SkinData[] = mockSkins.map((s) => ({ ...s, quantity: quantities[s.id] ?? 0 }));

  const displayUser: UserData = {
    id: nickname ?? 'me',
    nickname: nickname ?? '',
    avatarCharacter,
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    title: '放空愛好者',
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
          setMyStats(record.stats);
          setFriends(record.friends ?? []);
          setCoins(record.coins ?? STARTER_COINS);
        } else {
          setAvatarCharacter('cat');
          setQuantities(STARTER_QUANTITIES);
          setMyStats(STARTER_STATS);
          setFriends([]);
          setCoins(STARTER_COINS);
        }
        setNickname(savedNickname);
        setAccountReady(true);
      })();
    }
  }, []);

  // 資料有變動（背包庫存、放空紀錄、頭像、好友清單、零錢包）就自動存回雲端資料庫，
  // 這樣其他人用你的暱稱查詢時，看到的才是最新的
  useEffect(() => {
    if (!nickname || !accountReady) return;
    saveAccount(nickname, { avatarCharacter, quantities, stats: myStats, friends, coins });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantities, myStats, avatarCharacter, friends, coins, nickname, accountReady]);

  // 輸入暱稱畫面按下「開始放空」：如果這個暱稱雲端已經有資料就直接讀取，沒有的話幫他建一個新帳號
  const handleCreateAccount = async (name: string, avatar: CharacterType) => {
    const existing = await fetchAccount(name);
    if (existing) {
      setAvatarCharacter(existing.avatarCharacter);
      setQuantities(existing.quantities);
      setMyStats(existing.stats);
      setFriends(existing.friends ?? []);
      setCoins(existing.coins ?? STARTER_COINS);
    } else {
      setAvatarCharacter(avatar);
      setQuantities(STARTER_QUANTITIES);
      setMyStats(STARTER_STATS);
      setFriends([]);
      setCoins(STARTER_COINS);
      await saveAccount(name, {
        avatarCharacter: avatar,
        quantities: STARTER_QUANTITIES,
        stats: STARTER_STATS,
        friends: [],
        coins: STARTER_COINS,
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

  // 一選定應援棒（鎖定、開始抽）就立刻生效：背包那隻 -1、今日/本月/累積休息次數各 +1
  const handleConfirmSkin = (skinId: string) => {
    setQuantities((prev) => ({ ...prev, [skinId]: Math.max(0, (prev[skinId] ?? 0) - 1) }));
    setMyStats((prev) => ({
      ...prev,
      todayRestCount: prev.todayRestCount + 1,
      monthRestCount: prev.monthRestCount + 1,
      totalRestCount: prev.totalRestCount + 1,
    }));
  };

  // 真的抽完（燒完一支）：只補上這次的歷史紀錄，次數已經在選應援棒當下算過了，這裡不重複加
  const handlePuffFinished = (durationSeconds: number) => {
    setLastDuration(durationSeconds);
    setScreen('result');

    const now = new Date();
    const dateLabel = `${now.getMonth() + 1}/${now.getDate()}`;
    const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, '0');
    const seconds = String(durationSeconds % 60).padStart(2, '0');
    setMyStats((prev) => ({
      ...prev,
      history: [{ date: dateLabel, withWho: '獨自放空', duration: `${minutes}:${seconds}` }, ...prev.history].slice(0, 20),
    }));
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
  const handleTabChange = (tab: 'home' | 'collection' | 'stats') => {
    setActiveTab(tab);
    setScreen(tab);
  };
  const handleGoShop = () => setScreen('shop');
  const handleGoBackpack = () => setScreen('backpack');
  const handleGoGoodKid = () => setScreen('goodkid');
  // 商城每買一次要花 SHOP_PRICE 元（用零錢包的錢付），成功的話直接進 20 隻到背包
  const handlePurchase = (skinId: string) => {
    if (coins < SHOP_PRICE) {
      setToastMessage('零錢包餘額不足，去玩「我是好寶寶」賺點錢吧');
      return;
    }
    setCoins((prev) => prev - SHOP_PRICE);
    setQuantities((prev) => ({ ...prev, [skinId]: (prev[skinId] ?? 0) + 20 }));
  };
  // 小遊戲「我是好寶寶」每撿一隻應援棒，零錢包就 +amount 元
  const handleEarnCoin = (amount: number) => {
    setCoins((prev) => prev + amount);
  };

  // 輸入朋友暱稱查看他的放空紀錄：直接去共用的雲端資料庫用暱稱找（點好友頭像也是走這個）
  const handleSearchFriend = async (searchName: string) => {
    setToastMessage(null);
    const record = await fetchAccount(searchName);
    if (record) {
      setFriendRecord({ nickname: searchName, avatarCharacter: record.avatarCharacter, stats: record.stats });
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
  };

  const handleRemoveFriend = (name: string) => {
    setFriends((prev) => prev.filter((f) => f !== name));
  };

  // 在好友的放空紀錄頁按「加好友／移除好友」
  const handleToggleFriend = () => {
    if (!friendRecord) return;
    if (friends.includes(friendRecord.nickname)) {
      handleRemoveFriend(friendRecord.nickname);
    } else {
      setFriends((prev) => [...prev, friendRecord.nickname]);
      setFriendProfiles((prev) => ({ ...prev, [friendRecord.nickname]: friendRecord.avatarCharacter }));
    }
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
          onStartPuff={handleStartPuff}
          onGoCollection={() => handleTabChange('collection')}
          onGoShop={handleGoShop}
          onGoBackpack={handleGoBackpack}
          onGoGoodKid={handleGoGoodKid}
          onSearchFriend={handleSearchFriend}
          onViewFriend={handleSearchFriend}
          onAddFriend={handleAddFriend}
          friends={friends}
          friendProfiles={friendProfiles}
          skins={skins}
        />
      )}
      {screen === 'collection' && <CollectionScreen skins={skins} />}
      {screen === 'backpack' && <BackpackScreen skins={skins} onBack={handleBackHome} onGoShop={handleGoShop} />}
      {screen === 'stats' && <StatsScreen nickname={displayUser.nickname} avatarCharacter={avatarCharacter} stats={myStats} />}
      {screen === 'friend' && friendRecord && (
        <StatsScreen
          nickname={friendRecord.nickname}
          avatarCharacter={friendRecord.avatarCharacter}
          stats={friendRecord.stats}
          onBack={handleBackFromFriend}
          isFriend={friends.includes(friendRecord.nickname)}
          onToggleFriend={handleToggleFriend}
        />
      )}
      {screen === 'shop' && <ShopScreen skins={skins} coins={coins} onPurchase={handlePurchase} onBack={handleBackHome} />}
      {screen === 'goodkid' && <GoodKidGameScreen coins={coins} onEarnCoin={handleEarnCoin} onExit={handleBackHome} />}
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

      {(screen === 'home' || screen === 'collection' || screen === 'stats') && (
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
