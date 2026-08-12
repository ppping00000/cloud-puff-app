'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================
   Cloud Puff ☁️ — Web 單檔元件版
   直接把這個檔案放到 Next.js 專案的 app/page.tsx（或任一 page）
   即可部署到 Vercel。全部邏輯、樣式、假資料都包在同一個檔案裡，
   使用 styled-jsx（Next.js 內建，免安裝）做動畫與樣式。
   ============================================================ */

/* ---------------------- 型別 ---------------------- */

type CharacterType = 'panda' | 'cat' | 'fox' | 'rabbit';
type OnlineStatus = 'online' | 'offline' | 'in_room';
type CharacterState = 'idle' | 'inhale' | 'exhale' | 'relaxed';
type ScreenName = 'home' | 'puffroom' | 'result' | 'collection' | 'stats';

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

interface GroupData {
  id: string;
  name: string;
  emoji: string;
  onlineCount: number;
  memberCount: number;
}

interface SkinData {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  unlockHint?: string;
  cloudColor: string;
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

const mockCurrentUser: UserData = {
  id: 'uid_me',
  nickname: '雲朵貓',
  avatarCharacter: 'cat',
  level: 12,
  exp: 340,
  expToNextLevel: 500,
  title: '放空大師',
  onlineStatus: 'online',
  equippedSkin: 'grape_cloud',
};

const mockFriends: UserData[] = [
  { id: 'uid_a', nickname: '小白', avatarCharacter: 'rabbit', level: 8, exp: 100, expToNextLevel: 300, title: '新手放空員', onlineStatus: 'online', equippedSkin: 'classic_white' },
  { id: 'uid_b', nickname: '阿橘', avatarCharacter: 'fox', level: 15, exp: 220, expToNextLevel: 600, title: '陪伴達人', onlineStatus: 'online', equippedSkin: 'rainbow_cloud' },
  { id: 'uid_c', nickname: '胖胖', avatarCharacter: 'panda', level: 5, exp: 50, expToNextLevel: 200, title: '雲朵新人', onlineStatus: 'offline', equippedSkin: 'classic_white' },
];

const mockGroups: GroupData[] = [
  { id: 'group_1', name: '菸蟲2群', emoji: '☁️', onlineCount: 8, memberCount: 12 },
  { id: 'group_2', name: '深夜放空俱樂部', emoji: '🌙', onlineCount: 3, memberCount: 20 },
];

const mockSkins: SkinData[] = [
  { id: 'classic_white', name: '白雲 Classic', rarity: 'common', unlocked: true, cloudColor: '#FFFFFF' },
  { id: 'grape_cloud', name: '葡萄雲', rarity: 'rare', unlocked: true, cloudColor: '#B8A6FF' },
  { id: 'rainbow_cloud', name: '彩虹雲', rarity: 'epic', unlocked: true, cloudColor: '#FFD6E7' },
  { id: 'aurora_cloud', name: '極光雲', rarity: 'epic', unlocked: false, unlockHint: '需達到 Lv.15', cloudColor: '#CFF4D2' },
  { id: 'galaxy_cloud', name: '星河雲', rarity: 'legendary', unlocked: false, unlockHint: '連續登入 30 天', cloudColor: '#87CEEB' },
];

const mockHistory = [
  { date: '8/12', withWho: '阿橘、小白', duration: '05:32' },
  { date: '8/11', withWho: '雲朵群', duration: '12:10' },
  { date: '8/10', withWho: '阿橘', duration: '03:45' },
];

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
  left: number;
}

function CloudParticleLayer({ trigger, cloudColor }: { trigger: number; cloudColor: string }) {
  const [particles, setParticles] = useState<CloudParticle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const newOnes: CloudParticle[] = Array.from({ length: 3 }).map((_, i) => ({
      id: Date.now() + i,
      left: 40 + i * 60 + Math.random() * 20,
    }));
    setParticles((prev) => [...prev, ...newOnes]);
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newOnes.find((n) => n.id === p.id)));
    }, 1700);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, pointerEvents: 'none' }}>
      {particles.map((p) => (
        <span
          key={p.id}
          className="drift-cloud"
          style={{ position: 'absolute', top: 100, left: p.left, fontSize: 28, color: cloudColor }}
        >
          ☁️
        </span>
      ))}
      <style jsx>{`
        .drift-cloud {
          animation: drift 1.6s ease-out forwards;
        }
        @keyframes drift {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-120px); opacity: 0; }
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
   陪抽房核心互動邏輯（自訂 Hook）
   ============================================================ */

function usePuffRoom(onFinished: (durationSeconds: number) => void) {
  const [cigaretteLength, setCigaretteLength] = useState(100);
  const [characterState, setCharacterState] = useState<CharacterState>('idle');
  const [puffTrigger, setPuffTrigger] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const finishedRef = useRef(false);
  const durationRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (finishedRef.current) return;
      durationRef.current += 1;
      setDurationSeconds(durationRef.current);
      setCigaretteLength((len) => Math.max(0, len - 0.5));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cigaretteLength <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      setCharacterState('relaxed');
      onFinished(durationRef.current);
    }
  }, [cigaretteLength, onFinished]);

  const handleHoldStart = useCallback(() => {
    if (finishedRef.current) return;
    setCharacterState('inhale');
    setCigaretteLength((len) => Math.max(0, len - 2));
  }, []);

  const handleHoldEnd = useCallback(() => {
    if (finishedRef.current) return;
    setCharacterState('exhale');
    setPuffTrigger((t) => t + 1);
    setTimeout(() => {
      if (!finishedRef.current) setCharacterState('idle');
    }, 800);
  }, []);

  return { cigaretteLength, characterState, puffTrigger, durationSeconds, handleHoldStart, handleHoldEnd };
}

/* ============================================================
   畫面：首頁
   ============================================================ */

function HomeScreen({
  onStartPuff,
  onGoCollection,
}: {
  onStartPuff: () => void;
  onGoCollection: () => void;
}) {
  const progress = (mockCurrentUser.exp / mockCurrentUser.expToNextLevel) * 100;

  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      {/* 頂部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>☁️ Cloud Puff</h1>
        <div style={{ display: 'flex', gap: spacing.md, fontSize: 20 }}>
          <span>🔔</span>
          <span>⚙️</span>
        </div>
      </div>

      {/* 個人資料卡 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <AvatarBubble character={mockCurrentUser.avatarCharacter} size={64} status={mockCurrentUser.onlineStatus} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary }}>{mockCurrentUser.nickname}</span>
              <span style={{ background: colors.mintGreen, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 600, color: colors.textPrimary }}>
                Lv.{mockCurrentUser.level}
              </span>
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, margin: '4px 0' }}>稱號：{mockCurrentUser.title}</div>
            <ProgressBar progress={progress} />
          </div>
        </div>
      </Card>

      {/* 主 CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: `${spacing.xl}px 0` }}>
        <CloudButton label="開抽" onClick={onStartPuff} />
      </div>

      {/* 好友區 */}
      <SectionHeader title="我的好友" />
      <div style={{ display: 'flex', gap: spacing.md, overflowX: 'auto', paddingBottom: spacing.xs }}>
        {mockFriends.map((f) => (
          <div key={f.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 60, flexShrink: 0 }}>
            <AvatarBubble character={f.avatarCharacter} status={f.onlineStatus} size={52} />
            <span style={{ fontSize: 12, color: colors.textPrimary, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>
              {f.nickname}
            </span>
          </div>
        ))}
      </div>

      {/* 群組區 */}
      <SectionHeader title="我的群組" />
      {mockGroups.map((g) => (
        <div
          key={g.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: colors.milkTea,
            borderRadius: radius.card - 4,
            padding: spacing.sm,
            marginBottom: spacing.sm,
          }}
        >
          <span style={{ fontSize: 22 }}>{g.emoji}</span>
          <div style={{ flex: 1, marginLeft: spacing.sm }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>{g.name}</div>
            <div style={{ fontSize: 13, color: colors.textSecondary }}>
              👥 {g.onlineCount}人在線 / {g.memberCount}人
            </div>
          </div>
          <button
            onClick={onStartPuff}
            style={{
              background: colors.softPink,
              border: 'none',
              borderRadius: radius.pill,
              padding: `${spacing.xs}px ${spacing.md}px`,
              fontSize: 13,
              fontWeight: 600,
              color: colors.textPrimary,
              cursor: 'pointer',
            }}
          >
            加入
          </button>
        </div>
      ))}

      {/* 收藏預覽 */}
      <SectionHeader title="我的菸盒收藏" onPressMore={onGoCollection} />
      <div style={{ display: 'flex', gap: spacing.sm }}>
        {mockSkins.slice(0, 5).map((skin) => (
          <div
            key={skin.id}
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.card - 8,
              background: skin.unlocked ? skin.cloudColor : colors.surfaceMuted,
              opacity: skin.unlocked ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            {skin.unlocked ? '☁️' : '🔒'}
          </div>
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
  onFinished,
  onExit,
}: {
  onFinished: (durationSeconds: number) => void;
  onExit: () => void;
}) {
  const participants = [mockCurrentUser, mockFriends[1]];
  const skin = mockSkins.find((s) => s.id === mockCurrentUser.equippedSkin) ?? mockSkins[0];
  const { cigaretteLength, characterState, puffTrigger, durationSeconds, handleHoldStart, handleHoldEnd } =
    usePuffRoom(onFinished);

  const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, '0');
  const seconds = String(durationSeconds % 60).padStart(2, '0');

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
          ⏱ {minutes}:{seconds}
        </span>
      </div>

      <CloudParticleLayer trigger={puffTrigger} cloudColor={skin.cloudColor} />

      {/* 角色排列 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.xxl }}>
        {participants.map((p) => (
          <CharacterAvatar
            key={p.id}
            character={p.avatarCharacter}
            nickname={p.nickname}
            state={p.id === mockCurrentUser.id ? characterState : 'idle'}
          />
        ))}
      </div>

      {/* 菸支長度 */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginTop: spacing.xl }}>
        <ProgressBar progress={cigaretteLength} height={10} />
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>菸支剩餘 {Math.round(cigaretteLength)}%</div>
      </div>

      {/* 互動按鈕 */}
      <div style={{ padding: spacing.lg, marginTop: 'auto' }}>
        <HoldToPuffButton onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
      </div>
    </div>
  );
}

function HoldToPuffButton({ onHoldStart, onHoldEnd }: { onHoldStart: () => void; onHoldEnd: () => void }) {
  const [holding, setHolding] = useState(false);

  const start = () => {
    setHolding(true);
    onHoldStart();
  };
  const end = () => {
    setHolding(false);
    onHoldEnd();
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

function CollectionScreen() {
  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, marginBottom: spacing.md }}>☁️ 我的菸盒收藏</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
        {mockSkins.map((skin) => (
          <div
            key={skin.id}
            style={{
              background: colors.surface,
              borderRadius: radius.card,
              padding: spacing.md,
              textAlign: 'center',
              boxShadow: cardShadow,
              opacity: skin.unlocked ? 1 : 0.6,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                margin: '0 auto',
                borderRadius: radius.card - 8,
                background: skin.unlocked ? skin.cloudColor : colors.surfaceMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              {skin.unlocked ? '☁️' : '🔒'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginTop: 8 }}>{skin.name}</div>
            {!skin.unlocked && <div style={{ fontSize: 13, color: colors.textSecondary }}>{skin.unlockHint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   畫面：統計頁
   ============================================================ */

function StatsScreen() {
  const topFriend = mockFriends[1];

  return (
    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>📊 我的放空紀錄</h1>

      <div style={{ display: 'flex', gap: spacing.md }}>
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>本週休息次數</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary, marginTop: 4 }}>12 次</div>
        </Card>
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>累積休息時間</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary, marginTop: 4 }}>3小時20分</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary }}>最常一起陪抽</div>
        <div style={{ color: colors.textSecondary, marginTop: 4 }}>
          🦊 {topFriend.nickname}　×18次　❤️❤️❤️
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.sm }}>歷史紀錄</div>
        {mockHistory.map((h, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: idx < mockHistory.length - 1 ? `1px solid ${colors.surfaceMuted}` : 'none',
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
   主 App 元件（狀態切換取代路由，全部包在同一個檔案裡）
   ============================================================ */

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [activeTab, setActiveTab] = useState<'home' | 'collection' | 'stats'>('home');
  const [lastDuration, setLastDuration] = useState(0);

  const handleStartPuff = () => setScreen('puffroom');
  const handlePuffFinished = (durationSeconds: number) => {
    setLastDuration(durationSeconds);
    setScreen('result');
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
      {screen === 'home' && <HomeScreen onStartPuff={handleStartPuff} onGoCollection={() => handleTabChange('collection')} />}
      {screen === 'collection' && <CollectionScreen />}
      {screen === 'stats' && <StatsScreen />}
      {screen === 'puffroom' && <PuffRoomScreen onFinished={handlePuffFinished} onExit={handleExitRoom} />}
      {screen === 'result' && <ResultScreen durationSeconds={lastDuration} onReplay={handleReplay} onBackHome={handleBackHome} />}

      {(screen === 'home' || screen === 'collection' || screen === 'stats') && (
        <BottomTabBar active={activeTab} onChange={handleTabChange} />
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
