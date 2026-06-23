# HanziNote 📝

> 병음 입력부터 플래시카드 복습까지, 오프라인에서 동작하는 개인용 중국어 학습 PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![PWA](https://img.shields.io/badge/PWA-Offline-blueviolet.svg)](#pwa-사용-방법)

## 소개

HanziNote는 중국어를 학습하는 한국어 사용자를 위한 올인원 학습 앱입니다. 병음을 입력하면 자동으로 한자, 뜻, 발음이 단어장에 저장되고, 플래시카드 복습, 획순 학습, 쓰기 연습, 발음 평가까지 하나의 플랫폼에서 제공합니다.

- 🔌 **서버 불필요** — 모든 데이터는 브라우저 IndexedDB에 저장
- 📶 **오프라인 지원** — PWA로 설치하면 인터넷 없이도 학습 가능
- 📖 **10만+ 단어 사전** — CC-CEDICT 기반, HSK 1~6 100% 포함

## 주요 기능

| 기능 | 설명 |
|------|------|
| ⌨️ **단어 입력기** | 병음 또는 한글 뜻으로 검색 → 탭하면 자동 저장 |
| 🃏 **플래시카드** | Anki 스타일 간격 반복 학습 (쉬움/보통/어려움) |
| 📖 **단어장** | 카드 보기 + 리스트 보기, 자동 넘기기, 랜덤 순서 |
| ✍️ **쓰기 연습** | hanzi-writer 기반 획순 퀴즈 (따라쓰기/빈칸/받아쓰기) |
| 🖊️ **획순 학습** | 획순 애니메이션 (자동/한획씩/반복) |
| 🎤 **발음 연습** | TTS 듣기 + 마이크 녹음 + 음절별 점수 |
| 📊 **학습 통계** | 일별/전체 학습 현황 |
| ⚙️ **설정** | 글씨 크기, 병음/뜻 숨기기 등 |

## 스크린샷

> TODO: 스크린샷 추가 예정

## 설치 방법

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/HanziNote.git
cd HanziNote

# 의존성 설치
npm install

# 사전 빌드 (CC-CEDICT 다운로드 + 한국어 매핑)
npm run build:dict

# 개발 서버 실행
npm run dev
```

## 개발 환경

- Node.js 18+
- npm 9+

## 기술 스택

| 영역 | 기술 |
|------|------|
| UI | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | TailwindCSS 3 |
| State | Zustand |
| Storage | Dexie.js (IndexedDB) |
| TTS | Web Speech API |
| 획순 | hanzi-writer |
| PWA | vite-plugin-pwa (Workbox) |
| 사전 | CC-CEDICT (108,000+ entries) |
| Testing | Vitest + fast-check (PBT) |

## PWA 사용 방법

1. Chrome/Edge에서 앱을 열면 주소창에 "설치" 아이콘이 나타납니다
2. 클릭하여 설치하면 홈 화면에 앱 아이콘이 추가됩니다
3. 설치 후에는 오프라인에서도 단어장, 플래시카드, 쓰기 연습을 사용할 수 있습니다
4. TTS 발음 재생은 온라인 상태에서만 동작합니다

## 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview

# 테스트 실행
npm run test

# 사전 재빌드
npm run build:dict
```

## 로드맵

- [ ] 한국어 뜻 매핑 확대 (현재 50% → 80% 목표)
- [ ] HSK 등급별 학습 모드
- [ ] 학습 알림 (Push Notification)
- [ ] 다크 모드
- [ ] 데이터 내보내기/가져오기 (JSON)
- [ ] 성어(成语) 학습 모드
- [ ] 다국어 지원 (영어/일본어)

## 라이선스

[MIT License](LICENSE)

이 프로젝트는 MIT 라이선스로 배포됩니다. 자유롭게 사용, 수정, 배포할 수 있습니다.

### 사전 데이터 라이선스

- CC-CEDICT: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- hanzi-writer 획순 데이터: [MIT License](https://github.com/chanind/hanzi-writer)
