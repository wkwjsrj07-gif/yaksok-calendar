import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/rooms/[code] - 방 정보 + 참여자 + 불참 날짜 전부 가져오기
export async function GET(request, { params }) {
  try {
    const { code } = params;

    // 1. 방 찾기
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', code)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
    }

    // 2. 만료 확인
    if (new Date(room.expires_at) < new Date()) {
      return NextResponse.json({ error: '만료된 방입니다' }, { status: 410 });
    }

    // 3. 참여자 목록
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name, token')
      .eq('room_id', room.id);

    // 4. 불참 날짜 목록
    const { data: unavailableDates } = await supabase
      .from('unavailable_dates')
      .select('id, participant_id, date')
      .eq('room_id', room.id);

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.room_code,
        createdAt: room.created_at,
        expiresAt: room.expires_at,
        appointmentDate: room.appointment_date,
      },
      participants: participants || [],
      unavailableDates: unavailableDates || [],
    });
  } catch (err) {
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}
