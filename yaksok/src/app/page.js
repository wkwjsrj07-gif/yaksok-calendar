'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      const data = await res.json();
      if (data.roomCode) {
        router.push(`/room/${data.roomCode}`);
      }
    } catch (err) {
      alert('방 생성에 실패했습니다. 다시 시도해주세요.');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>📅</div>
        <h1 style={styles.title}>약속잡기 캘린더</h1>
        <p style={styles.desc}>
          모두가 되는 날을 한눈에!
          <br />
          방을 만들고 링크를 공유하세요.
        </p>

        <button
          onClick={createRoom}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '만드는 중...' : '방 만들기'}
        </button>

        <div style={styles.steps}>
          <div style={styles.step}>
            <span style={styles.stepNum}>1</span>
            <span>방을 만들면 고유 링크가 생성됩니다</span>
          </div>
          <div style={styles.step}>
            <span style={styles.stepNum}>2</span>
            <span>링크를 단톡방에 공유하세요</span>
          </div>
          <div style={styles.step}>
            <span style={styles.stepNum}>3</span>
            <span>각자 안 되는 날짜를 체크합니다</span>
          </div>
          <div style={styles.step}>
            <span style={styles.stepNum}>4</span>
            <span>초록색으로 남은 날 = 모두 가능한 날!</span>
          </div>
        </div>
      </div>

      <footer style={styles.footer}>
        방은 생성 후 30일간 유지됩니다
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #eff6ff 100%)',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '48px 36px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  },
  iconWrap: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '12px',
    color: '#1e293b',
  },
  desc: {
    fontSize: '15px',
    color: '#64748b',
    lineHeight: '1.6',
    marginBottom: '32px',
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '17px',
    fontWeight: '600',
    color: '#fff',
    background: '#22c55e',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '32px',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: 'left',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: '#475569',
  },
  stepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#f0fdf4',
    color: '#22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    flexShrink: 0,
  },
  footer: {
    marginTop: '24px',
    fontSize: '13px',
    color: '#94a3b8',
  },
};
