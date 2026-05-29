import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// POST /api/rooms/[code]/toggle - 날짜 불참 등록 또는 취소
export async function POST(request, { params }) {
  try {
    const { code } = params;
    const { token, date } = await request.json();

    // 1. 방 찾기
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', code)
      .single();

    if (!room) {
      return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
    }

    // 2. 토큰으로 참여자 확인 (본인 확인 = 조작 방지)
    const { data: participant } = await supabase
      .from('participants')
      .select('id, name')
      .eq('token', token)
      .eq('room_id', room.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: '참여자를 찾을 수 없습니다' }, { status: 403 });
    }

    // 3. 이미 불참 등록된 날짜인지 확인
    const { data: existing } = await supabase
      .from('unavailable_dates')
      .select('id')
      .eq('room_id', room.id)
      .eq('participant_id', participant.id)
      .eq('date', date)
      .single();

    if (existing) {
      // 이미 있으면 → 취소 (빨강 → 초록으로 빠짐)
      await supabase
        .from('unavailable_dates')
        .delete()
        .eq('id', existing.id);

      return NextResponse.json({ action: 'removed', date });
    } else {
      // 없으면 → 등록 (초록 → 빨강)
      await supabase
        .from('unavailable_dates')
        .insert({
          room_id: room.id,
          participant_id: participant.id,
          date: date,
        });

      return NextResponse.json({ action: 'added', date });
    }
  } catch (err) {
    return NextResponse.json({ error: '처리 실패' }, { status: 500 });
  }
}
