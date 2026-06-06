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

const TIME_LABELS = {
  morning: '오전부터',
  afternoon: '오후부터',
  evening: '저녁부터',
};

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
    if (err) { alert('참여 실패: ' + err.message); return; }
    localStorage.setItem('yaksok_' + code, token);
    setCurrentUser(pt);
    setShowNameInput(false);
    await fetchRoom();
  };

  // 날짜 클릭 - 모든 미래 날짜는 빨강(불참)이 디폴트
  // 클릭 시 시간대 선택 팝업 (가능 등록 또는 정보 보기)
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
      // 본인이 이미 등록한 날
      setPopup({ type: 'edit', date: dateStr, myTime: mine.available_from, myId: mine.id, others: others });
    } else {
      // 본인은 아직 등록 안 한 날
      setPopup({ type: 'add', date: dateStr, others: others });
    }
  };

  // 가능 등록
  const addAvailability = async (dateStr, timeSlot) => {
    if (!currentUser || !room) return;
    const { error } = await supabase.from('unavailable_dates').insert({
      room_id: room.id, participant_id: currentUser.id, date: dateStr, available_from: timeSlot,
    });
    if (error) { alert('등록 실패: ' + error.message); return; }
    await fetchRoom();
    setPopup(null);
  };

  // 가능 취소
  const removeAvailability = async (entryId) => {
    await supabase.from('unavailable_dates').delete().eq('id', entryId);
    await fetchRoom();
    setPopup(null);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // 디폴트 빨강. 본인이 가능 등록한 날만 초록.
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
              const dow = ds ? new Date(ds+'T00:00:00').getDay() : null;
              let bg = 'transparent', border = '1.5px solid transparent', color = '#1e293b', cursor = 'default';
              if (st === 'green') { bg = '#22c55e'; border = '1.5px solid #16a34a'; color = '#fff'; cursor = 'pointer'; }
              if (st === 'red') { bg = '#fee2e2'; border = '1.5px solid #fecaca'; color = '#991b1b'; cursor = 'pointer'; }
              if (st === 'past') { bg = '#f1f5f9'; color = '#cbd5e1'; }
              return (
                <div key={i} onClick={() => ds && st !== 'past' && st !== 'empty' && handleDateClick(ds)}
                  style={{aspectRatio:'1',borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',minHeight:48,background:bg,border:border,cursor:cursor,transition:'all 0.15s',padding:2}}>
                  {num && <>
                    <span style={{fontSize:14,fontWeight:600,color:color}}>{num}</span>
                    {myTime && <span style={{fontSize:9,color:'#fff',marginTop:1,fontWeight:600}}>{TIME_LABELS[myTime].replace('부터','')}</span>}
                    {cnt > 0 && st !== 'green' && <span style={{position:'absolute',top:2,right:4,fontSize:10,fontWeight:700,color:'#fff',background:'#22c55e',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{cnt}</span>}
                    {cnt > 1 && st === 'green' && <span style={{position:'absolute',top:2,right:4,fontSize:10,fontWeight:700,color:'#22c55e',background:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{cnt}</span>}
                  </>}
                </div>
              );
            })}
          </div>
          <div style={{display:'flex',gap:16,marginTop:16,justifyContent:'center',flexWrap:'wrap'}}>
            {[['#22c55e','내가 가능'],['#fee2e2','안 됨/미정'],['#e2e8f0','지난 날']].map(([c,t],i) => (
              <span key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#64748b'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:c,display:'inline-block',border: c==='#fee2e2' ? '1px solid #fecaca' : 'none'}}/> {t}
              </span>
            ))}
          </div>
          <p style={{textAlign:'center',color:'#94a3b8',fontSize:12,marginTop:12}}>날짜를 누르면 가능한 시간대를 선택할 수 있습니다</p>
        </div>

        <div style={{flex:'0 0 220px',background:'#fff',borderRadius:16,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',alignSelf:'flex-start'}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>참여자 ({participants.length}명)</h3>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {participants.map(p => (
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,fontSize:14,color:'#334155',background:currentUser && p.id===currentUser.id ? '#f0fdf4' : '#f8fafc',border:currentUser && p.id===currentUser.id ? '1px solid #bbf7d0' : '1px solid transparent'}}>
                <span style={{color:'#22c55e',fontSize:8}}>●</span>
                {p.name}
                {currentUser && p.id===currentUser.id && <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,color:'#22c55e',background:'#dcfce7',padding:'2px 8px',borderRadius:4}}>나</span>}
              </div>
            ))}
          </div>
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
                      • {o.name} — {TIME_LABELS[o.time]}
                    </div>
                  ))}
                </div>
              )}
              <p style={{fontSize:15,color:'#475569',marginBottom:16,marginTop:popup.others.length === 0 ? 16 : 0}}>몇 시부터 가능하세요?</p>
              <button onClick={() => addAvailability(popup.date, 'morning')} style={{...S.popupBtn,background:'#22c55e',color:'#fff',marginBottom:8}}>오전부터 (9시 ~)</button>
              <button onClick={() => addAvailability(popup.date, 'afternoon')} style={{...S.popupBtn,background:'#22c55e',color:'#fff',marginBottom:8}}>오후부터 (12시 ~)</button>
              <button onClick={() => addAvailability(popup.date, 'evening')} style={{...S.popupBtn,background:'#22c55e',color:'#fff',marginBottom:8}}>저녁부터 (18시 ~)</button>
              <button onClick={() => setPopup(null)} style={{...S.popupBtn,background:'#f1f5f9',color:'#64748b'}}>취소</button>
            </>}

            {popup.type === 'edit' && <>
              <div style={{background:'#dcfce7',borderRadius:10,padding:12,marginBottom:12,textAlign:'left'}}>
                <p style={{fontSize:13,fontWeight:600,color:'#166534'}}>내 가능 시간: {TIME_LABELS[popup.myTime]}</p>
              </div>
              {popup.others.length > 0 && (
                <div style={{background:'#f0fdf4',borderRadius:10,padding:12,marginBottom:16,textAlign:'left'}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#166534',marginBottom:6}}>다른 참여자:</p>
                  {popup.others.map((o,i) => (
                    <div key={i} style={{fontSize:13,color:'#166534',marginBottom:2}}>
                      • {o.name} — {TIME_LABELS[o.time]}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => removeAvailability(popup.myId)} style={{...S.popupBtn,background:'#ef4444',color:'#fff',marginBottom:8}}>가능 취소</button>
              <button onClick={() => setPopup(null)} style={{...S.popupBtn,background:'#f1f5f9',color:'#64748b'}}>닫기</button>
            </>}
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
  popupCard: {background:'#fff',borderRadius:20,padding:'28px 24px',maxWidth:360,width:'100%',textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,0.12)'},
  popupBtn: {width:'100%',padding:14,fontSize:15,fontWeight:600,borderRadius:10,display:'block'},
};
