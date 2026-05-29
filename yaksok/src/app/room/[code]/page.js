'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

export default function RoomPage() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [popup, setPopup] = useState(null); // { type, date, names }
  const [copied, setCopied] = useState(false);

  // 방 데이터 불러오기
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (res.status === 404) {
        setError('존재하지 않는 방입니다.');
        return;
      }
      if (res.status === 410) {
        setError('만료된 방입니다.');
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setRoom(data.room);
      setParticipants(data.participants);
      setUnavailableDates(data.unavailableDates);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    }
  }, [code]);

  // 초기 로딩: 방 데이터 + 토큰 확인
  useEffect(() => {
    const init = async () => {
      await fetchRoom();
      const token = localStorage.getItem(`yaksok_token_${code}`);
      if (token) {
        // 재접속 시도
        try {
          const res = await fetch(`/api/rooms/${code}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ existingToken: token }),
          });
          const data = await res.json();
          if (data.participant) {
            setCurrentUser(data.participant);
          } else {
            setShowNameInput(true);
          }
        } catch {
          setShowNameInput(true);
        }
      } else {
        setShowNameInput(true);
      }
      setLoading(false);
    };
    init();
  }, [code, fetchRoom]);

  // 이름 입력 후 참여
  const handleJoin = async () => {
    if (!nameValue.trim()) return;
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      const data = await res.json();
      if (data.participant) {
        localStorage.setItem(`yaksok_token_${code}`, data.participant.token);
        setCurrentUser(data.participant);
        setShowNameInput(false);
        await fetchRoom(); // 참여자 목록 갱신
      }
    } catch {
      alert('참여에 실패했습니다.');
    }
  };

  // 날짜 클릭 처리
  const handleDateClick = (dateStr) => {
    if (!currentUser) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const clickedDate = new Date(dateStr + 'T00:00:00');
    if (clickedDate < today) return; // 과거 날짜 무시

    // 이 날짜에 불참인 사람들
    const unavailableForDate = unavailableDates.filter(u => u.date === dateStr);
    const myEntry = unavailableForDate.find(u => u.participant_id === currentUser.id);
    const unavailableNames = unavailableForDate.map(u => {
      const p = participants.find(p => p.id === u.participant_id);
      return p ? p.name : '알 수 없음';
    });

    if (unavailableForDate.length === 0) {
      // 초록색 날짜 → "약속이 있으십니까?" 확인
      setPopup({
        type: 'confirm_add',
        date: dateStr,
        names: [],
      });
    } else {
      // 빨간색 날짜 → 불참 명단 보여주기 + 내 것만 취소 가능
      setPopup({
        type: 'show_unavailable',
        date: dateStr,
        names: unavailableNames,
        canCancel: !!myEntry,
      });
    }
  };

  // 불참 등록/취소 실행
  const toggleDate = async (dateStr) => {
    try {
      const token = localStorage.getItem(`yaksok_token_${code}`);
      const res = await fetch(`/api/rooms/${code}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, date: dateStr }),
      });
      await res.json();
      await fetchRoom(); // 데이터 갱신
      setPopup(null);
    } catch {
      alert('처리에 실패했습니다.');
    }
  };

  // 링크 복사
  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 달력 데이터 생성
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // 빈칸 (1일 시작 전)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 날짜들
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // 날짜 상태 확인
  const getDateStatus = (dateStr) => {
    if (!dateStr) return 'empty';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    if (d < today) return 'past';

    const count = unavailableDates.filter(u => u.date === dateStr).length;
    if (count > 0) return 'red';
    return 'green';
  };

  // 불참 인원 수
  const getUnavailableCount = (dateStr) => {
    return unavailableDates.filter(u => u.date === dateStr).length;
  };

  // --- 렌더링 ---

  if (loading) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.spinner} />
        <p>불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.loadingWrap}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😢</div>
        <p style={{ fontSize: '18px', fontWeight: '600' }}>{error}</p>
      </div>
    );
  }

  // 이름 입력 화면
  if (showNameInput) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.nameCard}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👋</div>
          <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>이름을 입력하세요</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            약속 투표에 참여할 이름을 적어주세요
          </p>
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="예: 홍길동"
            style={s.nameInput}
            autoFocus
          />
          <button onClick={handleJoin} style={s.joinBtn}>
            입장하기
          </button>
        </div>
      </div>
    );
  }

  const days = getDaysInMonth(currentMonth);
  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div style={s.pageWrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <h1 style={s.headerTitle}>📅 약속잡기</h1>
        <button onClick={copyLink} style={s.copyBtn}>
          {copied ? '✅ 복사됨!' : '🔗 링크 복사'}
        </button>
      </div>

      <div style={s.mainLayout}>
        {/* 캘린더 영역 */}
        <div style={s.calendarSection}>
          {/* 월 이동 */}
          <div style={s.monthNav}>
            <button onClick={prevMonth} style={s.navBtn}>◀</button>
            <span style={s.monthLabel}>{monthLabel}</span>
            <button onClick={nextMonth} style={s.navBtn}>▶</button>
          </div>

          {/* 요일 헤더 */}
          <div style={s.weekHeader}>
            {weekDays.map((w, i) => (
              <div key={i} style={{
                ...s.weekDay,
                color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#64748b',
              }}>
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={s.daysGrid}>
            {days.map((dateStr, i) => {
              const status = getDateStatus(dateStr);
              const dayNum = dateStr ? parseInt(dateStr.split('-')[2]) : null;
              const count = dateStr ? getUnavailableCount(dateStr) : 0;
              const dayOfWeek = dateStr ? new Date(dateStr + 'T00:00:00').getDay() : null;

              return (
                <div
                  key={i}
                  onClick={() => dateStr && status !== 'past' && handleDateClick(dateStr)}
                  style={{
                    ...s.dayCell,
                    ...(status === 'green' ? s.greenCell : {}),
                    ...(status === 'red' ? s.redCell : {}),
                    ...(status === 'past' ? s.pastCell : {}),
                    ...(status === 'empty' ? s.emptyCell : {}),
                    cursor: status === 'green' || status === 'red' ? 'pointer' : 'default',
                  }}
                >
                  {dayNum && (
                    <>
                      <span style={{
                        ...s.dayNum,
                        color: status === 'past' ? '#cbd5e1' :
                               status === 'red' ? '#fff' :
                               status === 'green' ? '#166534' :
                               dayOfWeek === 0 ? '#ef4444' :
                               dayOfWeek === 6 ? '#3b82f6' : '#1e293b',
                      }}>
                        {dayNum}
                      </span>
                      {count > 0 && (
                        <span style={s.badge}>{count}</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div style={s.legend}>
            <span style={s.legendItem}>
              <span style={{ ...s.legendDot, background: '#22c55e' }} /> 모두 가능
            </span>
            <span style={s.legendItem}>
              <span style={{ ...s.legendDot, background: '#ef4444' }} /> 불참 있음
            </span>
            <span style={s.legendItem}>
              <span style={{ ...s.legendDot, background: '#e2e8f0' }} /> 지난 날
            </span>
          </div>
        </div>

        {/* 참여자 명단 */}
        <div style={s.sidebar}>
          <h3 style={s.sidebarTitle}>
            참여자 ({participants.length}명)
          </h3>
          <div style={s.participantList}>
            {participants.map((p) => (
              <div key={p.id} style={{
                ...s.participantItem,
                ...(currentUser && p.id === currentUser.id ? s.participantMe : {}),
              }}>
                <span style={s.participantDot}>●</span>
                {p.name}
                {currentUser && p.id === currentUser.id && (
                  <span style={s.meTag}>나</span>
                )}
              </div>
            ))}
          </div>

          {/* 방 정보 */}
          <div style={s.roomInfo}>
            <p style={s.roomInfoText}>
              만료: {new Date(room.expiresAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </div>

      {/* 팝업 */}
      {popup && (
        <div style={s.overlay} onClick={() => setPopup(null)}>
          <div style={s.popupCard} onClick={(e) => e.stopPropagation()}>
            {popup.type === 'confirm_add' && (
              <>
                <h3 style={s.popupTitle}>
                  {formatDateKR(popup.date)}
                </h3>
                <p style={s.popupDesc}>이 날 약속이 있으십니까?</p>
                <div style={s.popupBtns}>
                  <button
                    onClick={() => toggleDate(popup.date)}
                    style={s.popupBtnYes}
                  >
                    예, 약속 있어요
                  </button>
                  <button
                    onClick={() => setPopup(null)}
                    style={s.popupBtnNo}
                  >
                    아니요
                  </button>
                </div>
              </>
            )}

            {popup.type === 'show_unavailable' && (
              <>
                <h3 style={s.popupTitle}>
                  {formatDateKR(popup.date)}
                </h3>
                <div style={s.unavailableList}>
                  <p style={s.unavailableLabel}>현재 불참 인원:</p>
                  {popup.names.map((name, i) => (
                    <span key={i} style={s.unavailableName}>{name}</span>
                  ))}
                </div>
                {popup.canCancel && (
                  <button
                    onClick={() => toggleDate(popup.date)}
                    style={s.popupBtnCancel}
                  >
                    내 약속 취소하기
                  </button>
                )}
                <button
                  onClick={() => setPopup(null)}
                  style={s.popupBtnClose}
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 날짜 포맷 (2026-05-24 → 5월 24일 (일))
function formatDateKR(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekDays[d.getDay()]})`;
}

// --- 스타일 ---
const s = {
  loadingWrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f8fafc',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #22c55e',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '12px',
  },
  nameCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '40px 32px',
    maxWidth: '380px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  },
  nameInput: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    marginBottom: '12px',
    textAlign: 'center',
  },
  joinBtn: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    background: '#22c55e',
    borderRadius: '10px',
  },
  pageWrap: {
    minHeight: '100vh',
    background: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: '700',
  },
  copyBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    background: '#f1f5f9',
    borderRadius: '8px',
    color: '#475569',
  },
  mainLayout: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  calendarSection: {
    flex: '1 1 500px',
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  monthNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  navBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#f1f5f9',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
  },
  monthLabel: {
    fontSize: '18px',
    fontWeight: '700',
  },
  weekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginBottom: '8px',
  },
  weekDay: {
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '600',
    padding: '8px 0',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  dayCell: {
    aspectRatio: '1',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'all 0.15s',
    minHeight: '44px',
  },
  greenCell: {
    background: '#dcfce7',
    border: '1.5px solid #bbf7d0',
  },
  redCell: {
    background: '#ef4444',
    border: '1.5px solid #dc2626',
  },
  pastCell: {
    background: '#f1f5f9',
    border: '1.5px solid transparent',
  },
  emptyCell: {
    background: 'transparent',
    border: '1.5px solid transparent',
  },
  dayNum: {
    fontSize: '14px',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: '2px',
    right: '4px',
    fontSize: '10px',
    fontWeight: '700',
    color: '#fff',
    background: 'rgba(0,0,0,0.25)',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginTop: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#64748b',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  sidebar: {
    flex: '0 0 220px',
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    alignSelf: 'flex-start',
  },
  sidebarTitle: {
    fontSize: '15px',
    fontWeight: '700',
    marginBottom: '12px',
    color: '#1e293b',
  },
  participantList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  participantItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#f8fafc',
    fontSize: '14px',
    color: '#334155',
  },
  participantMe: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
  },
  participantDot: {
    color: '#22c55e',
    fontSize: '8px',
  },
  meTag: {
    marginLeft: 'auto',
    fontSize: '11px',
    fontWeight: '600',
    color: '#22c55e',
    background: '#dcfce7',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  roomInfo: {
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0',
  },
  roomInfoText: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  // 팝업
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  popupCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '32px 28px',
    maxWidth: '340px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  },
  popupTitle: {
    fontSize: '18px',
    fontWeight: '700',
    marginBottom: '12px',
  },
  popupDesc: {
    fontSize: '15px',
    color: '#475569',
    marginBottom: '24px',
  },
  popupBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  popupBtnYes: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    background: '#ef4444',
    borderRadius: '10px',
  },
  popupBtnNo: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: '500',
    color: '#64748b',
    background: '#f1f5f9',
    borderRadius: '10px',
  },
  unavailableList: {
    background: '#fee2e2',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '16px',
    textAlign: 'left',
  },
  unavailableLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: '8px',
  },
  unavailableName: {
    display: 'inline-block',
    background: '#fff',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#dc2626',
    margin: '2px 4px 2px 0',
  },
  popupBtnCancel: {
    width: '100%',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    background: '#22c55e',
    borderRadius: '10px',
    marginBottom: '8px',
  },
  popupBtnClose: {
    width: '100%',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '500',
    color: '#64748b',
    background: '#f1f5f9',
    borderRadius: '10px',
  },
};
