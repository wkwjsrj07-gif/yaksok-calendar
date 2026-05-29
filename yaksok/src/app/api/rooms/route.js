import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

function generateCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/rooms - 방 만들기
export async function POST() {
  try {
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

    if (error) throw error;

    return NextResponse.json({ roomCode: data.room_code });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
