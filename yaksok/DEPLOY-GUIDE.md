# 🚀 약속잡기 캘린더 - 배포 가이드

이 문서를 따라하면 앱이 인터넷에 올라가서 누구나 접속할 수 있게 됩니다.
**총 3단계**이고, 각 단계별로 스크린샷 찍듯이 설명합니다.

---

## 1단계: Supabase 가입 + 데이터베이스 만들기

Supabase = 창고(DB) 서비스. 무료로 쓸 수 있어요.

1. [https://supabase.com](https://supabase.com) 접속
2. **Start your project** 클릭 → GitHub 계정으로 가입
3. **New project** 클릭
   - Organization: 기본값 그대로
   - Project name: `yaksok` (아무거나 가능)
   - Database Password: 아무 비밀번호 (기억할 필요 없음)
   - Region: **Northeast Asia (Seoul)** 선택
   - **Create new project** 클릭
4. 프로젝트가 만들어지면 왼쪽 메뉴에서 **SQL Editor** 클릭
5. `supabase-schema.sql` 파일 내용을 **전체 복사** → SQL Editor에 **붙여넣기**
6. **Run** 버튼 클릭 → "Success" 뜨면 완료!

7. **키 복사하기** (이게 제일 중요!)
   - 왼쪽 메뉴 → ⚙️ **Project Settings** → **API**
   - `Project URL` 복사해두기 (https://xxxx.supabase.co)
   - `anon public` 키 복사해두기 (eyJ로 시작하는 긴 문자열)

---

## 2단계: GitHub에 코드 올리기

1. [https://github.com](https://github.com) 가입 (이미 있으면 로그인)
2. 오른쪽 위 **+** 버튼 → **New repository**
   - Repository name: `yaksok-calendar`
   - **Public** 선택
   - **Create repository** 클릭
3. 이 프로젝트 폴더의 모든 파일을 GitHub에 업로드
   - 방법 1 (쉬운 방법): GitHub 페이지에서 **uploading an existing file** 클릭 → 파일 전부 드래그
   - 방법 2 (터미널): 아래 명령어 실행
   ```bash
   cd yaksok
   git init
   git add .
   git commit -m "약속잡기 캘린더"
   git remote add origin https://github.com/너의아이디/yaksok-calendar.git
   git push -u origin main
   ```

---

## 3단계: Vercel에 배포하기

1. [https://vercel.com](https://vercel.com) 접속 → **GitHub 계정으로** 로그인
2. **Add New...** → **Project**
3. 방금 만든 `yaksok-calendar` 저장소 선택 → **Import**
4. **Environment Variables** 섹션에 2개 입력:
   ```
   이름: NEXT_PUBLIC_SUPABASE_URL
   값: (1단계에서 복사한 Project URL)

   이름: NEXT_PUBLIC_SUPABASE_ANON_KEY
   값: (1단계에서 복사한 anon public 키)
   ```
5. **Deploy** 클릭!

배포 완료되면 `https://yaksok-calendar.vercel.app` 같은 주소가 나옵니다.
이 주소가 바로 너의 앱 주소! 단톡방에 공유하면 바로 쓸 수 있어요.

---

## 🔧 문제가 생기면?

- **화면이 안 뜨면**: Vercel 대시보드 → Deployments → 에러 로그 확인
- **데이터가 저장 안 되면**: Supabase URL과 Key가 정확한지 확인
- **방이 안 만들어지면**: Supabase SQL Editor에서 테이블이 잘 만들어졌는지 확인
