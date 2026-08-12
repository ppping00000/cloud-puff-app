import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/* ============================================================
   簡易帳號系統的 API 路由
   路徑：這個檔案要放在 app/api/account/route.ts

   GET  /api/account?nickname=xxx   → 讀取這個暱稱的資料（沒有回傳 data: null）
   POST /api/account                → 存這個暱稱的資料，body: { nickname, record }

   沒有密碼、沒有登入驗證，純粹用「暱稱」當 key，
   大家共用同一個 KV 資料庫，只是每個暱稱各自存一筆。
   ============================================================ */

function keyFor(nickname: string) {
  return `cloudpuff:account:${nickname}`;
}

export async function GET(req: NextRequest) {
  const nickname = req.nextUrl.searchParams.get('nickname');
  if (!nickname) {
    return NextResponse.json({ error: 'missing nickname' }, { status: 400 });
  }
  const data = await kv.get(keyFor(nickname));
  return NextResponse.json({ data: data ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nickname, record } = body ?? {};
  if (!nickname || !record) {
    return NextResponse.json({ error: 'missing nickname or record' }, { status: 400 });
  }
  await kv.set(keyFor(nickname), record);
  return NextResponse.json({ ok: true });
}
