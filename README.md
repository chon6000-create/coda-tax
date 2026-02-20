# 유튜버 세무정석 (YouTuber Tax Ledger)

이 프로젝트는 Vite를 기반으로 한 단일 페이지 애플리케이션(SPA)입니다.
로컬 환경에서 안정적으로 실행하기 위해 웹 서버 사용을 권장합니다.

## 🚀 실행 방법 (권장)

### 1. Vite 개발 서버 (가장 빠름)
Node.js가 설치되어 있다면 가장 권장하는 방법입니다.
```bash
# 의존성 설치 (최초 1회)
npm install

# 개발 서버 실행
npm run dev
```

### 2. VSCode Live Server (간편함)
VSCode 확장에서 **Live Server**를 설치한 후:
1. `index.html` 파일을 우클릭합니다.
2. **Open with Live Server**를 선택합니다.

### 3. npx / Python 간이 서버
터미널에서 즉시 실행이 필요한 경우:
```bash
# npx 사용 시
npx serve .

# Python 사용 시 (Python 3.x)
python -m http.server
```

## 📂 주요 파일 구조
- `index.html`: 애플리케이션의 단일 진입점 및 구조
- `CODA_Refund_App.js`: 라우팅 및 비즈니스 로직 (Hash Router 사용)
- `CODA_Refund_Style.css`: 프리미엄 SaaS 스타일 가이드

## ⚠️ 주의사항
- `file:///` 경로로 직접 파일을 열 경우, 브라우저의 보안 정책상 모듈 로딩이나 일부 고급 기능이 제한될 수 있습니다. 반드시 위의 방법 중 하나를 사용하여 `http://localhost...` 주소로 접속하시기 바랍니다.
