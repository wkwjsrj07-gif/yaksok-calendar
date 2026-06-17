'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function makeToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < 20; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
}

// 시간 인코딩/디코딩
// 형식: "am_9_30" = 오전 9시 30분, "pm_3_0" = 오후 3시 00분
function encodeTime(period, hour, min) {
  return period + '_' + hour + '_' + min;
}

function parseTime(encoded) {
  if (!encoded) return null;
  const parts = encoded.split('_');
  if (parts.length !== 3) {
    // 옛날 형식 (morning/afternoon/evening) 호환
    if (encoded === 'morning') return { period: 'am', hour: 9, min: 0 };
    if (encoded === 'afternoon') return { period: 'pm', hour: 12, min: 0 };
    if (encoded === 'evening') return { period: 'pm', hour: 6, min: 0 };
    return null;
  }
  return { period: parts[0], hour: parseInt(parts[1]), min: parseInt(parts[2]) };
}

function timeLabel(encoded) {
  const t = parseTime(encoded);
  if (!t) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const periodStr = t.period === 'am' ? '오전' : '오후';
  return periodStr + ' ' + t.hour + ':' + pad(t.min);
}

function timeLabelLong(encoded) {
  const t = parseTime(encoded);
  if (!t) return '';
  const periodStr = t.period === 'am' ? '오전' : '오후';
  if (t.min === 0) return periodStr + ' ' + t.hour + '시부터';
  return periodStr + ' ' + t.hour + '시 ' + t.min + '분부터';
}

export default function RoomPage() {
  const params = useParams();
  const code = params.code;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [popup, setPopup] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 시간 입력 상태
  const [timePeriod, setTimePeriod] = useState('am');
  const [timeHour, setTimeHour] = useState('');
  const [timeMin, setTimeMin] = useState('');
  
  // 참여자 클릭 상세 팝업
  const [participantPopup, setParticipantPopup] = useState(null);

  const fetchRoom = useCallback(async () => {
    const { data: rm, error: rmErr } = await supabase
      .from('rooms').select('*').eq('room_code', code).maybeSingle();
    if (rmErr || !rm) { setError('존재하지 않는 방입니다.'); return null; }
    if (new Date(rm.expires_at) < new Date()) { setError('만료된 방입니다.'); return null; }
    setRoom(rm);
    const { data: pts } = await supabase
      .from('participants').select('id, name, token').eq('room_id', rm.id);
    setParticipants(pts || []);
    const { data: dts } = await supabase
      .from('unavailable_dates').select('id, participant_id, date, available_from').eq('room_id', rm.id);
    setAvailableDates(dts || []);
    return rm;
  }, [code]);

  useEffect(() => {
    const init = async () => {
      const rm = await fetchRoom();
      if (!rm) { setLoading(false); return; }
      const savedToken = localStorage.getItem('yaksok_' + code);
      if (savedToken) {
        const { data: found } = await supabase
          .from('participants').select('*').eq('token', savedToken).eq('room_id', rm.id).maybeSingle();
        if (found) setCurrentUser(found);
        else setShowNameInput(true);
      } else setShowNameInput(true);
      setLoading(false);
    };
    init();
  }, [code, fetchRoom]);

  const handleJoin = async () => {
    const name = nameValue.trim();
    if (!name || !room) return;
    const token = makeToken();
    const { data: pt, error: err } = await supabase
      .from('participants').insert({ room_id: room.id, name: name, token: token }).select().single();
    if (err) { alert('참여에 실패했어요. 잠시 후 다시 시도해주세요.'); return; }
    localStorage.setItem('yaksok_' + code, token);
    setCurrentUser(pt);
    setShowNameInput(false);
    await fetchRoom();
  };

  const handleDateClick = (dateStr) => {
    if (!currentUser) return;
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(dateStr + 'T00:00:00') < today) return;

    const forDate = availableDates.filter(u => u.date === dateStr);
    const mine = forDate.find(u => u.participant_id === currentUser.id);
    const others = forDate.filter(u => u.participant_id !== currentUser.id).map(u => {
      const p = participants.find(pp => pp.id === u.participant_id);
      return { name: p ? p.name : '?', time: u.available_from };
    });

    if (mine) {
      setPopup({ type: 'edit', date: dateStr, myTime: mine.available_from, myId: mine.id, others: others });
    } else {
      setTimePeriod('am');
      setTimeHour('');
      setTimeMin('');
      setPopup({ type: 'add', date: dateStr, others: others });
    }
  };

  const addAvailability = async () => {
    if (!currentUser || !room || saving) return;
    
    // 입력 검증
    const hourNum = parseInt(timeHour);
    const minNum = parseInt(timeMin);
    if (!timeHour || isNaN(hourNum) || hourNum < 1 || hourNum > 12) {
      alert('시간은 1부터 12 사이로 입력해주세요.');
      return;
    }
    if (timeMin === '' || isNaN(minNum) || minNum < 0 || minNum > 59) {
      alert('분은 0부터 59 사이로 입력해주세요.');
      return;
    }
    
    setSaving(true);
    const encoded = encodeTime(timePeriod, hourNum, minNum);
    const { error } = await supabase.from('unavailable_dates').insert({
      room_id: room.id, participant_id: currentUser.id, date: popup.date, available_from: encoded,
    });
    setSaving(false);
    
    if (error) {
      // 친절한 에러 메시지
      if (error.code === '23505' || error.message.includes('duplicate')) {
        alert('이미 등록된 일정이에요. 새로고침 후 다시 시도해주세요.');
      } else {
        alert('등록에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
      await fetchRoom();
      setPopup(null);
      return;
    }
    await fetchRoom();
    setPopup(null);
  };

  const removeAvailability = async (entryId) => {
    if (saving) return;
    setSaving(true);
    const { error } = await supabase.from('unavailable_dates').delete().eq('id', entryId);
    setSaving(false);
    if (error) {
      alert('취소에 실패했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    await fetchRoom();
    setPopup(null);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 참여자 클릭 - 가능일 보기
  const handleParticipantClick = (participant) => {
    const myDates = availableDates
      .filter(u => u.participant_id === participant.id)
      .map(u => ({ date: u.date, time: u.available_from }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setParticipantPopup({ participant, dates: myDates });
  };

  const getDays = () => {
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= total; d++) {
      days.push(y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0'));
    }
    return days;
  };

  const getStatus = (ds) => {
    if (!ds) return 'empty';
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(ds + 'T00:00:00') < today) return 'past';
    if (!currentUser) return 'red';
    const mine = availableDates.find(u => u.date === ds && u.participant_id === currentUser.id);
    return mine ? 'green' : 'red';
  };

  const getMyTime = (ds) => {
    if (!currentUser) return null;
    const mine = availableDates.find(u => u.date === ds && u.participant_id === currentUser.id);
    return mine ? mine.available_from : null;
  };

  const countAvailable = (ds) => availableDates.filter(u => u.date === ds).length;

  if (loading) return <div style={S.center}><p>불러오는 중...</p></div>;
  if (error) return <div style={S.center}><p style={{fontSize:'48px'}}>😢</p><p style={{fontSize:'18px',fontWeight:600,marginTop:12}}>{error}</p></div>;

  if (showNameInput) {
    return (
      <div style={S.center}>
        <div style={S.nameCard}>
          <p style={{fontSize:'40px',marginBottom:12}}>👋</p>
          <h2 style={{fontSize:'22px',marginBottom:8}}>이름을 입력하세요</h2>
          <p style={{color:'#64748b',fontSize:'14px',marginBottom:24}}>약속 투표에 참여할 이름을 적어주세요</p>
          <input value={nameValue} onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="예: 홍길동" style={S.nameInput} autoFocus />
          <button onClick={handleJoin} style={S.greenBtn}>입장하기</button>
        </div>
      </div>
    );
  }

  const days = getDays();
  const wk = ['일','월','화','수','목','금','토'];

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:10}}>
        <h1 style={{fontSize:'20px',fontWeight:700}}>📅 약속잡기</h1>
        <button onClick={copyLink} style={{padding:'8px 16px',fontSize:'13px',fontWeight:600,background:'#f1f5f9',borderRadius:'8px',color:'#475569'}}>{copied ? '✅ 복사됨!' : '🔗 링크 복사'}</button>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:20,display:'flex',gap:20,flexWrap:'wrap'}}>
        <div style={{flex:'1 1 500px',background:'#fff',borderRadius:16,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} style={S.navBtn}>◀</button>
            <span style={{fontSize:18,fontWeight:700}}>{currentMonth.getFullYear()}년 {currentMonth.getMonth()+1}월</span>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))} style={S.navBtn}>▶</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:8}}>
            {wk.map((w,i) => <div key={i} style={{textAlign:'center',fontSize:13,fontWeight:600,padding:'8px 0',color:i===0?'#ef4444':i===6?'#3b82f6':'#64748b'}}>{w}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
            {days.map((ds, i) => {
              const st = getStatus(ds);
              const num = ds ? parseInt(ds.split('-')[2]) : null;
              const cnt = ds ? countAvailable(ds) : 0;
              const myTime = ds ? getMyTime(ds) : null;
              let bg = 'transparent', border = '1.5px solid transparent', color = '#1e293b', cursor = 'default';
              if (st === 'green') { bg = '#22c55e'; border = '1.5px solid #16a34a'; color = '#fff'; cursor = 'pointer'; }
              if (st === 'red') { bg = '#fee2e2'; border = '1.5px solid #fecaca'; color = '#991b1b'; cursor = 'pointer'; }
              if (st === 'past') { bg = '#f1f5f9'; color = '#cbd5e1'; }
              return (
                <div key={i} onClick={() => ds && st !== 'past' && st !== 'empty' && handleDateClick(ds)}
                  style={{aspectRatio:'1',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',minHeight:48,background:bg,border:border,cursor:cursor,transition:'all 0.15s',padding:2}}>
                  {num && <>
                    <span style={{fontSize:14,fontWeight:600,color:color}}>{num}</span>
                    {myTime && <span style={{fontSize:9,color:'#fff',marginTop:1,fontWeight:600,whiteSpace:'nowrap'}}>{timeLabel(myTime)}</span>}
                    {cnt > 0 && st !== 'green' && <span style={{position:'absolute',top:2,right:4,fontSize:10,fontWeight:700,color:'#fff',background:'#22c55e',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{cnt}</span>}
                    {cnt > 1 && st === 'green' && <span style={{position:'absolute',top:2,right:4,fontSize:10,fontWeight:700,color:'#22c55e',background:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{cnt}</span>}
                  </>}
                </div>
              );
            })}
          </div>
          <div style={{display:'flex',gap:16,marginTop:16,justifyContent:'center',flexWrap:'wrap'}}>
            <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#64748b'}}>
              <span style={{width:18,height:18,borderRadius:5,background:'#22c55e',border:'1.5px solid #16a34a',display:'inline-block'}}/> 내가 가능
            </span>
            <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#64748b'}}>
              <span style={{width:18,height:18,borderRadius:'50%',background:'#22c55e',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>n</span>
              가능한 인원 수
            </span>
            <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#64748b'}}>
              <span style={{width:18,height:18,borderRadius:5,background:'#fee2e2',border:'1.5px solid #fecaca',display:'inline-block'}}/> 안 됨/미정
            </span>
            <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#64748b'}}>
              <span style={{width:18,height:18,borderRadius:5,background:'#f1f5f9',border:'1.5px solid #e2e8f0',display:'inline-block'}}/> 지난 날
            </span>
          </div>
          <p style={{textAlign:'center',color:'#94a3b8',fontSize:12,marginTop:12}}>날짜를 누르면 가능한 시간을 입력할 수 있습니다</p>
        </div>

        <div style={{flex:'0 0 220px',background:'#fff',borderRadius:16,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',alignSelf:'flex-start'}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>참여자 ({participants.length}명)</h3>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {participants.map(p => (
              <div key={p.id} onClick={() => handleParticipantClick(p)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,fontSize:14,color:'#334155',background:currentUser && p.id===currentUser.id ? '#f0fdf4' : '#f8fafc',border:currentUser && p.id===currentUser.id ? '1px solid #bbf7d0' : '1px solid transparent',cursor:'pointer',transition:'all 0.15s'}}>
                <span style={{color:'#22c55e',fontSize:8}}>●</span>
                {p.name}
                {currentUser && p.id===currentUser.id && <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,color:'#22c55e',background:'#dcfce7',padding:'2px 8px',borderRadius:4}}>나</span>}
              </div>
            ))}
          </div>
          <p style={{fontSize:11,color:'#94a3b8',marginTop:8,textAlign:'center'}}>이름을 누르면 가능일을 볼 수 있어요</p>
          <div style={{marginTop:16,paddingTop:12,borderTop:'1px solid #e2e8f0'}}>
            <p style={{fontSize:12,color:'#94a3b8'}}>만료: {room && new Date(room.expires_at).toLocaleDateString('ko-KR')}</p>
          </div>
        </div>
      </div>

      {popup && (
        <div style={S.overlay} onClick={() => setPopup(null)}>
          <div style={S.popupCard} onClick={e => e.stopPropagation()}>
            <h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>{fmtDate(popup.date)}</h3>

            {popup.type === 'add' && <>
              {popup.others.length > 0 && (
                <div style={{background:'#f0fdf4',borderRadius:10,padding:12,marginBottom:16,textAlign:'left'}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#166534',marginBottom:6}}>다른 참여자 가능 시간:</p>
                  {popup.others.map((o,i) => (
                    <div key={i} style={{fontSize:13,color:'#166534',marginBottom:2}}>
                      • {o.name} — {timeLabelLong(o.time)}
                    </div>
                  ))}
                </div>
              )}
              <p style={{fontSize:15,color:'#475569',marginBottom:16,marginTop:popup.others.length === 0 ? 16 : 0}}>몇 시부터 가능하세요?</p>
              
              {/* 오전/오후 라디오 */}
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <button onClick={() => setTimePeriod('am')}
                  style={{flex:1,padding:'10px',borderRadius:8,fontSize:14,fontWeight:600,
                    background:timePeriod === 'am' ? '#22c55e' : '#f1f5f9',
                    color:timePeriod === 'am' ? '#fff' : '#64748b',border:'none'}}>
                  오전
                </button>
                <button onClick={() => setTimePeriod('pm')}
                  style={{flex:1,padding:'10px',borderRadius:8,fontSize:14,fontWeight:600,
                    background:timePeriod === 'pm' ? '#22c55e' : '#f1f5f9',
                    color:timePeriod === 'pm' ? '#fff' : '#64748b',border:'none'}}>
                  오후
                </button>
              </div>
              
              {/* 시간 입력 */}
              <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'center',marginBottom:16}}>
                <input type="number" min="1" max="12" placeholder="시"
                  value={timeHour} onChange={e => setTimeHour(e.target.value)}
                  style={{width:70,padding:'10px',fontSize:16,textAlign:'center',border:'2px solid #e2e8f0',borderRadius:8,outline:'none'}}/>
                <span style={{fontSize:14,color:'#64748b'}}>시</span>
                <input type="number" min="0" max="59" placeholder="분"
                  value={timeMin} onChange={e => setTimeMin(e.target.value)}
                  style={{width:70,padding:'10px',fontSize:16,textAlign:'center',border:'2px solid #e2e8f0',borderRadius:8,outline:'none'}}/>
                <span style={{fontSize:14,color:'#64748b'}}>분</span>
              </div>
              
              <button onClick={addAvailability} disabled={saving}
                style={{...S.popupBtn,background:saving ? '#86efac' : '#22c55e',color:'#fff',marginBottom:8,cursor:saving?'not-allowed':'pointer'}}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setPopup(null)} style={{...S.popupBtn,background:'#f1f5f9',color:'#64748b'}}>취소</button>
            </>}

            {popup.type === 'edit' && <>
              <div style={{background:'#dcfce7',borderRadius:10,padding:12,marginBottom:12,textAlign:'left'}}>
                <p style={{fontSize:13,fontWeight:600,color:'#166534'}}>내 가능 시간: {timeLabelLong(popup.myTime)}</p>
              </div>
              {popup.others.length > 0 && (
                <div style={{background:'#f0fdf4',borderRadius:10,padding:12,marginBottom:16,textAlign:'left'}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#166534',marginBottom:6}}>다른 참여자:</p>
                  {popup.others.map((o,i) => (
                    <div key={i} style={{fontSize:13,color:'#166534',marginBottom:2}}>
                      • {o.name} — {timeLabelLong(o.time)}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => removeAvailability(popup.myId)} disabled={saving}
                style={{...S.popupBtn,background:saving ? '#fca5a5' : '#ef4444',color:'#fff',marginBottom:8,cursor:saving?'not-allowed':'pointer'}}>
                {saving ? '취소 중...' : '가능 취소'}
              </button>
              <button onClick={() => setPopup(null)} style={{...S.popupBtn,background:'#f1f5f9',color:'#64748b'}}>닫기</button>
            </>}
          </div>
        </div>
      )}

      {/* 참여자 가능일 보기 팝업 */}
      {participantPopup && (
        <div style={S.overlay} onClick={() => setParticipantPopup(null)}>
          <div style={S.popupCard} onClick={e => e.stopPropagation()}>
            <h3 style={{fontSize:18,fontWeight:700,marginBottom:4}}>{participantPopup.participant.name}님의 가능일</h3>
            <p style={{fontSize:13,color:'#64748b',marginBottom:16}}>총 {participantPopup.dates.length}개의 가능일</p>
            
            {participantPopup.dates.length === 0 ? (
              <div style={{padding:'24px 12px',background:'#f8fafc',borderRadius:10,marginBottom:16}}>
                <p style={{fontSize:14,color:'#94a3b8'}}>아직 등록된 가능일이 없어요</p>
              </div>
            ) : (
              <div style={{maxHeight:300,overflowY:'auto',marginBottom:16,textAlign:'left'}}>
                {participantPopup.dates.map((d,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'#f0fdf4',borderRadius:8,marginBottom:6}}>
                    <span style={{fontSize:14,fontWeight:600,color:'#166534'}}>{fmtDate(d.date)}</span>
                    <span style={{fontSize:13,color:'#16a34a'}}>{timeLabelLong(d.time)}</span>
                  </div>
                ))}
              </div>
            )}
            
            <button onClick={() => setParticipantPopup(null)} style={{...S.popupBtn,background:'#f1f5f9',color:'#64748b'}}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(ds) {
  const d = new Date(ds + 'T00:00:00');
  return (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + ['일','월','화','수','목','금','토'][d.getDay()] + ')';
}

const S = {
  center: {minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,background:'#f8fafc'},
  nameCard: {background:'#fff',borderRadius:20,padding:'40px 32px',maxWidth:380,width:'100%',textAlign:'center',boxShadow:'0 4px 24px rgba(0,0,0,0.06)'},
  nameInput: {width:'100%',padding:'14px 16px',fontSize:16,border:'2px solid #e2e8f0',borderRadius:10,marginBottom:12,textAlign:'center'},
  greenBtn: {width:'100%',padding:14,fontSize:16,fontWeight:600,color:'#fff',background:'#22c55e',borderRadius:10},
  navBtn: {width:36,height:36,borderRadius:8,background:'#f1f5f9',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',color:'#475569'},
  overlay: {position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20},
  popupCard: {background:'#fff',borderRadius:20,padding:'28px 24px',maxWidth:400,width:'100%',textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,0.12)'},
  popupBtn: {width:'100%',padding:14,fontSize:15,fontWeight:600,borderRadius:10,display:'block'},
};
