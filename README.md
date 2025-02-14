# 🌱 Garden

> **잠시 핸드폰을 내려놓고 현실의 중요한 일에 집중해야 할 때, Garden에서 꽃을 키워보세요!**  
> 사용자가 지정한 시간 또는 일정 시간 동안 웹에서 벗어나지 않으면 보상을 주어  
> 사용자의 사용 습관을 건강하게 관리해주는 서비스입니다.
---

## 🤼‍♀️ DEVELOPER

| [이승찬](https://github.com/chan000518) | [민서](https://github.com/m2nsp) | [김홍엽](https://github.com/Yeobi00) | [조은수](https://github.com/ssikssikhan-cho) |
|--------|--------|--------|--------|
| <img width="150px" src="https://github.com/chan000518.png"> | <img width="150px" src="https://github.com/m2nsp.png"> | <img width="150px" src="https://github.com/Yeobi00.png"> | <img width="150px" src="https://github.com/ssikssikhan-cho.png"> |
---

## 🌟 주요 기능 소개

### 👤 유저 & 친구 기능
- **카카오 로그인** 및 **카카오 프로필 연동**을 통해 간편하게 로그인할 수 있습니다.
- 친구 추가 기능을 통해 **친구의 집중 기록을 확인**하고, 랭킹 페이지에서 비교할 수 있습니다.

### ⏳ 집중 시간 관리
- 사용자가 직접 설정한 **타이머 기반 집중 시간** 또는 종료 전까지 실행되는 **스톱워치 모드** 지원.
- **SSE(Server-Sent Events) 연결**을 통해 특정 시간 동안 웹 서비스를 이용하지 않는지를 추적하여  
  페이지를 벗어나면 **집중 실패**로 처리합니다.
- 1/4주기로 클라이언트로 신호를 보내 꽃이 자라는 이미지를 변경합니다

### 🎯 미션 시스템
- 특정 행동을 수행해야 하는 **미션 기능** 제공.
- **미션 리스트 조회** 및 **남은 미션 진행 상황 확인** 가능.

### 📊 통계 제공
- 사용자의 집중 시간 데이터를 분석하여 **다양한 통계 정보** 제공.
- 자신의 집중 습관을 객관적으로 확인하고, 개선할 수 있도록 도와줍니다.

---

## 구현 세부 사항

## 1. 집중 시간 생겅 및 관리 로직

### ✅ **이벤트 기반 집중 시간 관리 (Redis 활용)**
- 집중 시간이 생성되면 시간으로 Redis Sorted Set(`zAdd`)을 사용해 실행 예약
- `setInterval(1000ms)`을 이용해 1초마다 현재 시간으로 기준으로 이벤트 체크 후 실행
- 불필요한 주기적인 DB 업데이트 없이 집중 시간이 완료 시점에서만 DB 업데이트
- 집중시간 1/4마다 클라이언트로 이미지 변화를 넘겨주고 다음 1/4시간이 자날 떄 실행되게 Redis에 등록
- 타이머에 해당하는 시간이 모두 지나거나 클라이언트가 미 연결 시 집중시간을 알맞게 처리후 DB에 요청

### ✅ **실시간 데이터 전송 (SSE 기반)**
- 클라이언트는 SSE(Server-Sent Events)로 실시간 업데이트를 로그인한 계정 별로 수신
- 클라이언트가 연결이 끊겨도 재연결하면 최신 데이터 요청 가능
- 클라이언트의 로그인한 id를 중심으로 묶어 계정으로 관리하여 중복 접속을 처리
- SSE 연결이 끊어져도 즉시 집중 시간을 종료하지 않고, 클라이언트 재연결을 기다림
- 재 연결 시 현재 상황에 맞는 응답을 Redis에서 조회하여 전달

### 🛠 **서버에서 집중 시간을 관리하는 이유**
- 클라이언트에서 집중 시간을 직접 관리하면 로직이 복잡해질 가능성이 높음.
- 클라이언트의 예상치 못한 행동 (예: 같은 계정으로 중복 로그인, 브라우저 강제 종료)을 처리하기 위해 서버에서 집중 시간 관리.
- sse로 전달한 데이터를 띄우고 집중시간 생성, 종료만 클라이언트에서 실행하게 서버에서 관리하려고 함

### 레디스를 사용한 이우
- 모든 집중시간을 `setInterval`로 관리하면 너무 많은 이벤트가 서버에 등록됌 
- 클라이언트의 조회와 이벤트 실행이 모두 데이터 베이스 요청으로 처리 시 부하가 커질 것 같다고 생각됌
- 이를 위해 레디스를 사용하여 레디스에 시간을 기준으로 이벤트를 등록하여 해당 시간이 되면 이벤트를 실행하게 함

### sse api과 생성api, 종료 api 3개의 api로 클라이언트가 더 쉽게 사용할 수 있도록 설계, DB 요청 최소화

---

## 🏗️ 시스템 아키텍처 (서버 구조)
![서버 구조](docs/서버구조.jpeg)

## 🛢️ ERD (데이터베이스 구조)
![ERD](docs/erd.png)
