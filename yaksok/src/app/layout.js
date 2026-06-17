import './globals.css';
export const metadata = {
  title: '약속잡기 캘린더',
  description: '모두가 되는 날을 한눈에 찾는 약속잡기 도구',
};
export default function RootLayout({ children }) {
  return (<html lang="ko"><body>{children}</body></html>);
}
