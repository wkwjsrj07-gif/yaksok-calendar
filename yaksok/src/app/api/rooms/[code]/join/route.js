import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

function generateToken(length = 20) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/rooms/[code]/join - 이름 입력해서 방 참여
export async function POST(request, { params }) {
  try {
    const { code } = params;
    const { name, existingToken } = await request.json();

    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', code)
      .single();

    if (!room) {
      return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
    }

    if (existingToken) {
      const { data: existing } = await supabase
        .from('participants')
        .select('*')
        .eq('token', existingToken)
        .eq('room_id', room.id)
        .single();

      if (existing) {
        return NextResponse.json({
          participant: existing,
          isReturning: true,
        });
      }
    }

    const token = generateToken(20);
    const { data: participant, error } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        name: name.trim(),
        token: token,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      participant,
      isReturning: false,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
