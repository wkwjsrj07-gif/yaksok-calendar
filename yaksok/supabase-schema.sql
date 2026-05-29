-- =============================================
-- 약속잡기 캘린더 - 데이터베이스 스키마
-- Supabase SQL Editor에서 이 전체를 복사 붙여넣기 하세요
-- =============================================

-- 1. 방 테이블 (창고의 사물함)
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL,          -- 링크에 들어가는 고유 번호 (예: x7k9p2)
  created_at TIMESTAMPTZ DEFAULT NOW(),    -- 방 만든 시각
  expires_at TIMESTAMPTZ NOT NULL,         -- 방 만료 시각 (기본 30일 뒤)
  appointment_date DATE DEFAULT NULL       -- 약속 날짜 (정해지면 여기 저장)
);

-- 2. 참여자 테이블 (누가 들어왔는지)
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- 참여자 이름
  token TEXT UNIQUE NOT NULL,              -- 브라우저 식별 토큰 (재접속용)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 불참 날짜 테이블 (누가 어느 날 안 되는지)
CREATE TABLE unavailable_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  date DATE NOT NULL,                      -- 안 되는 날짜
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, participant_id, date)    -- 같은 사람이 같은 날 중복 등록 방지
);

-- 4. RLS (Row Level Security) 비활성화 - 학교 과제용 간단 설정
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE unavailable_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on participants" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on unavailable_dates" ON unavailable_dates FOR ALL USING (true) WITH CHECK (true);
