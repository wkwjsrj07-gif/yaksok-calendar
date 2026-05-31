'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function generateCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const roomCode = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        alert('방 생성 실패: ' + error.message);
        setLoading(false);
        return;
      }

      router.push('/room/' + roomCode);
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px',background:'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #eff6ff 100%)'}}>
      <div style={{background:'#fff',borderRadius:'20px',padding:'48px 36px',maxWidth:'420px',width:'100%',textAlign:'center',boxShadow:'0 4px 24px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>📅</div>
        <h1 style={{fontSize:'28px',fontWeight:'700',marginBottom:'12px',color:'#1e293b'}}>약속잡기 캘린더</h1>
        <p style={{fontSize:'15px',color:'#64748b',lineHeight:'1.6',marginBottom:'32px'}}>
          모두가 되는 날을 한눈에!<br/>방을 만들고 링크를 공유하세요.
        </p>
        <button
          onClick={createRoom}
          disabled={loading}
          style={{width:'100%',padding:'16px',fontSize:'17px',fontWeight:'600',color:'#fff',background:loading?'#86efac':'#22c55e',borderRadius:'12px',marginBottom:'32px',cursor:loading?'not-allowed':'pointer'}}
        >
          {loading ? '만드는 중...' : '방 만들기'}
        </button>
        <div style={{display:'flex',flexDirection:'column',gap:'12px',textAlign:'left'}}>
          {[
            '방을 만들면 고유 링크가 생성됩니다',
            '링크를 단톡방에 공유하세요',
            '각자 안 되는 날짜를 체크합니다',
            '초록색으로 남은 날 = 모두 가능한 날!',
          ].map((text, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',fontSize:'14px',color:'#475569'}}>
              <span style={{width:'28px',height:'28px',borderRadius:'50%',background:'#f0fdf4',color:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'13px',flexShrink:0}}>{i+1}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <footer style={{marginTop:'24px',fontSize:'13px',color:'#94a3b8'}}>방은 생성 후 30일간 유지됩니다</footer>
    </div>
  );
}
