import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function generateCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json({
        error: '환경변수 없음',
        hasUrl: !!url,
        hasKey: !!key,
      }, { status: 500 });
    }

    const supabase = createClient(url, key);

    const roomCode = generateCode(6);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        error: 'DB 에러',
        detail: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json({ roomCode: data.room_code });
  } catch (err) {
    return NextResponse.json({
      error: '서버 에러',
      detail: err.message,
    }, { status: 500 });
  }
}
