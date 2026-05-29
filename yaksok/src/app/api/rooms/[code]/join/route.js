import { supabase } from '@/lib/supabase';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

// POST /api/rooms/[code]/join - 이름 입력해서 방 참여
export async function POST(request, { params }) {
  try {
    const { code } = params;
    const { name, existingToken } = await request.json();

    // 1. 방 찾기
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', code)
      .single();

    if (!room) {
      return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
    }

    // 2. 기존 토큰이 있으면 → 재접속 (이미 등록된 사람)
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

    // 3. 새 참여자 등록 + 토큰 발급
    const token = nanoid(20);
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
    return NextResponse.json({ error: '참여 실패' }, { status: 500 });
  }
}
