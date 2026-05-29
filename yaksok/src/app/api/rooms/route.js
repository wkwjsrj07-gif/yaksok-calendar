import { supabase } from '@/lib/supabase';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

// POST /api/rooms - 방 만들기
export async function POST() {
  try {
    // 1. 랜덤 방 코드 생성 (6자리)
    const roomCode = nanoid(6);

    // 2. 만료일 = 지금부터 30일 뒤
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 3. 창고(DB)에 방 등록
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // 4. 방 코드 돌려주기
    return NextResponse.json({ roomCode: data.room_code });
  } catch (err) {
    return NextResponse.json({ error: '방 생성 실패' }, { status: 500 });
  }
}
