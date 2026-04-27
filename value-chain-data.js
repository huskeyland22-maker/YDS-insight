window.VALUE_CHAIN_SECTORS = [
  {
    id: "hbm-ai-semiconductor",
    order: 1,
    icon: "🧠",
    name: "HBM / AI 반도체",
    heat: "VERY HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "삼성전자", code: "005930", tip: "메모리·파운드리 양축 운영" },
      { name: "SK하이닉스", code: "000660", tip: "HBM 주도권 핵심" },
      { name: "한미반도체", code: "042700", tip: "HBM TC본더 경쟁력" },
      { name: "이오테크닉스", code: "039030", tip: "레이저 공정 장비 강점" },
      { name: "리노공업", code: "058470", tip: "반도체 테스트 소켓 강자" }
    ],
    hidden: [
      { name: "HPSP", code: "403870", tip: "고압 수소 어닐링 장비" },
      { name: "테크윙", code: "089030", tip: "메모리 테스트 장비" },
      { name: "피에스케이홀딩스", code: "031980", tip: "후공정 장비 포트폴리오" },
      { name: "에스티아이", code: "039440", tip: "반도체·디스플레이 장비" },
      { name: "오픈엣지테크놀로지", code: "394280", tip: "온디바이스 AI IP" }
    ]
  },
  {
    id: "solid-state-battery",
    order: 2,
    icon: "🔋",
    name: "전고체 / 차세대 배터리",
    heat: "HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "LG에너지솔루션", code: "373220", tip: "글로벌 배터리 셀 선도" },
      { name: "삼성SDI", code: "006400", tip: "프리미엄 배터리 포지션" },
      { name: "POSCO홀딩스", code: "005490", tip: "소재-광물 밸류체인" },
      { name: "에코프로비엠", code: "247540", tip: "양극재 대표주" },
      { name: "엘앤에프", code: "066970", tip: "하이니켈 양극재 공급" }
    ],
    hidden: [
      { name: "이수스페셜티케미컬", code: "457190", tip: "전고체 소재 기대주" },
      { name: "나노신소재", code: "121600", tip: "도전재·첨가제 기술" },
      { name: "대주전자재료", code: "078600", tip: "실리콘 음극재 핵심" },
      { name: "필에너지", code: "378340", tip: "배터리 장비 신성장" },
      { name: "씨아이에스", code: "222080", tip: "전극공정 장비 공급" }
    ]
  },
  {
    id: "defense",
    order: 3,
    icon: "🛡️",
    name: "K-방산 (수출 주도)",
    heat: "VERY HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "한화에어로스페이스", code: "012450", tip: "엔진·지상 방산 확장" },
      { name: "현대로템", code: "064350", tip: "K2 전차 수출 모멘텀" },
      { name: "LIG넥스원", code: "079550", tip: "유도무기 체계 강점" },
      { name: "한국항공우주", code: "047810", tip: "항공·군수 체계 통합" },
      { name: "한화시스템", code: "272210", tip: "레이다·C4I 역량" }
    ],
    hidden: [
      { name: "제노코", code: "361390", tip: "위성통신·방산 부품" },
      { name: "퍼스텍", code: "010820", tip: "방산 기계부품 공급" },
      { name: "비츠로테크", code: "042370", tip: "전력·방산 계열 수혜" },
      { name: "켄코아에어로스페이스", code: "274090", tip: "항공 구조물 전문" },
      { name: "아이쓰리시스템", code: "214430", tip: "적외선 영상센서" }
    ]
  },
  {
    id: "nuclear-smr",
    order: 4,
    icon: "⚛️",
    name: "원전 / SMR",
    heat: "HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "두산에너빌리티", code: "034020", tip: "원전 주기기 핵심" },
      { name: "현대건설", code: "000720", tip: "해외 원전 EPC 경험" },
      { name: "대우건설", code: "047040", tip: "원전·에너지 플랜트 참여" },
      { name: "한전기술", code: "052690", tip: "원전 설계 엔지니어링" },
      { name: "우리기술", code: "032820", tip: "원전 제어계측 관련" }
    ],
    hidden: [
      { name: "우진", code: "105840", tip: "원전 계측기기 강점" },
      { name: "에너토크", code: "019990", tip: "밸브 액추에이터" },
      { name: "비에이치아이", code: "083650", tip: "발전 기자재 공급" },
      { name: "일진파워", code: "094820", tip: "원자력 정비 서비스" },
      { name: "오르비텍", code: "046120", tip: "원전 안전·해체 관련" }
    ]
  },
  {
    id: "power-grid-hvdc",
    order: 5,
    icon: "⚡",
    name: "전력 인프라 / HVDC",
    heat: "VERY HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "효성중공업", code: "298040", tip: "변압기·전력기기 핵심 공급" },
      { name: "LS ELECTRIC", code: "010120", tip: "송배전·전력 자동화 중심" },
      { name: "HD현대일렉트릭", code: "267260", tip: "초고압 변압기 수요 수혜" },
      { name: "대한전선", code: "001440", tip: "초고압·해저 케이블 확대" },
      { name: "일진전기", code: "103590", tip: "전력기기·전선 밸류체인" }
    ],
    hidden: [
      { name: "가온전선", code: "000500", tip: "전력·통신 케이블 생산" },
      { name: "제룡전기", code: "033100", tip: "배전·변압기 중소형 강점" },
      { name: "LS전선아시아", code: "229640", tip: "아시아 전력케이블 거점" },
      { name: "누리플렉스", code: "040160", tip: "스마트그리드·AMI 솔루션" },
      { name: "피에스텍", code: "002230", tip: "전력계측·배전 인프라" }
    ]
  },
  {
    id: "biosimilar-cdmo",
    order: 6,
    icon: "🧬",
    name: "바이오시밀러 / CDMO",
    heat: "WARM",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "삼성바이오로직스", code: "207940", tip: "글로벌 CDMO 리더" },
      { name: "셀트리온", code: "068270", tip: "바이오시밀러 파이프라인" },
      { name: "유한양행", code: "000100", tip: "신약 개발 협업 확대" },
      { name: "한미약품", code: "128940", tip: "R&D 기반 기술수출" },
      { name: "알테오젠", code: "196170", tip: "플랫폼 기술 성장성" }
    ],
    hidden: [
      { name: "에스티팜", code: "237690", tip: "올리고 API 경쟁력" },
      { name: "바이넥스", code: "053030", tip: "CMO 생산 인프라" },
      { name: "펩트론", code: "087010", tip: "약효지속 기술 보유" },
      { name: "리가켐바이오", code: "141080", tip: "ADC 파이프라인 기대" },
      { name: "에이비엘바이오", code: "298380", tip: "이중항체 기술주" }
    ]
  },
  {
    id: "on-device-ai-robotics",
    order: 7,
    icon: "🤖",
    name: "온디바이스 AI / 로봇",
    heat: "VERY HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "레인보우로보틱스", code: "277810", tip: "휴머노이드 기대감" },
      { name: "두산로보틱스", code: "454910", tip: "협동로봇 대표주" },
      { name: "LG전자", code: "066570", tip: "AI 가전·로봇 확장" },
      { name: "네이버", code: "035420", tip: "AI 모델·로봇 플랫폼" },
      { name: "카카오", code: "035720", tip: "AI 서비스 생태계 강화" }
    ],
    hidden: [
      { name: "제주반도체", code: "080220", tip: "모바일 메모리 특화" },
      { name: "고영", code: "098460", tip: "3D 검사 장비·로봇수술" },
      { name: "뉴로메카", code: "348340", tip: "협동로봇 솔루션" },
      { name: "에스비비테크", code: "389500", tip: "로봇 감속기 부품" },
      { name: "심텍", code: "222800", tip: "고다층 패키지기판" }
    ]
  },
  {
    id: "aerospace",
    order: 8,
    icon: "🚀",
    name: "우주항공 (K-NASA)",
    heat: "HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "한화에어로스페이스", code: "012450", tip: "발사체·항공엔진 축" },
      { name: "한국항공우주", code: "047810", tip: "위성·항공체계 역량" },
      { name: "현대차", code: "005380", tip: "AAM 미래 모빌리티" },
      { name: "대한항공", code: "003490", tip: "항공우주 MRO·기술축적" },
      { name: "인텔리안테크", code: "189300", tip: "위성통신 안테나 강자" }
    ],
    hidden: [
      { name: "컨텍", code: "451760", tip: "지상국 데이터 서비스" },
      { name: "쎄트렉아이", code: "099320", tip: "소형위성 제조 역량" },
      { name: "루미르", code: "474170", tip: "우주광학·센서 관련" },
      { name: "제노코", code: "361390", tip: "우주항공 전장부품" },
      { name: "에이치브이엠", code: "295310", tip: "우주소재 부품 확장" }
    ]
  },
  {
    id: "shipbuilding-offshore",
    order: 9,
    icon: "🚢",
    name: "조선 / 해양 플랜트",
    heat: "WARM",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "HD현대중공업", code: "329180", tip: "고부가 선종 경쟁력" },
      { name: "삼성중공업", code: "010140", tip: "LNG선·해양플랜트" },
      { name: "한화오션", code: "042660", tip: "방산-조선 시너지" },
      { name: "HD한국조선해양", code: "009540", tip: "지주형 조선 포트폴리오" },
      { name: "HD현대마린솔루션", code: "443060", tip: "선박 서비스 수익원" }
    ],
    hidden: [
      { name: "현대힘스", code: "460930", tip: "선박 블록 제조" },
      { name: "동성화인텍", code: "033500", tip: "LNG 보냉재·조선 기자재" },
      { name: "한국카본", code: "017960", tip: "LNG 보냉재 강점" },
      { name: "세진중공업", code: "075580", tip: "선박 구조물 생산" },
      { name: "태광", code: "023160", tip: "피팅·배관 부품" }
    ]
  },
  {
    id: "entertainment-kculture",
    order: 10,
    icon: "🎬",
    name: "엔터 / K-컬처",
    heat: "HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "하이브", code: "352820", tip: "글로벌 팬덤 플랫폼" },
      { name: "JYP Ent.", code: "035900", tip: "아티스트 IP 고성장" },
      { name: "에스엠", code: "041510", tip: "멀티레이블 전략" },
      { name: "와이지엔터테인먼트", code: "122870", tip: "아티스트 라인업 복귀" },
      { name: "CJ ENM", code: "035760", tip: "콘텐츠·미디어 밸류체인" }
    ],
    hidden: [
      { name: "디어유", code: "376300", tip: "팬 커뮤니케이션 플랫폼" },
      { name: "실리콘투", code: "257720", tip: "K-뷰티 글로벌 유통" },
      { name: "삼화네트웍스", code: "046390", tip: "드라마 제작사" },
      { name: "자이언트스텝", code: "289220", tip: "버추얼 제작 기술" },
      { name: "스튜디오드래곤", code: "253450", tip: "드라마 IP 제작 강자" }
    ]
  },
  {
    id: "autonomous-automotive",
    order: 11,
    icon: "🚘",
    name: "자율주행 / 전장",
    heat: "VERY HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "현대모비스", code: "012330", tip: "전장·AD 핵심 부품" },
      { name: "현대차", code: "005380", tip: "SDV 전환 선도" },
      { name: "삼성전기", code: "009150", tip: "MLCC·전장부품 확대" },
      { name: "LG이노텍", code: "011070", tip: "카메라·통신 모듈" },
      { name: "HL만도", code: "204320", tip: "제동·조향 ADAS 부품" }
    ],
    hidden: [
      { name: "넥스트칩", code: "396270", tip: "차량용 영상 반도체" },
      { name: "퓨런티어", code: "370090", tip: "ADAS 공정 장비" },
      { name: "스마트레이더시스템", code: "424960", tip: "차량 레이더 센서" },
      { name: "모트렉스", code: "118990", tip: "IVI·차량 인포테인먼트" },
      { name: "에이테크솔루션", code: "071670", tip: "차량용 금형·부품" }
    ]
  },
  {
    id: "ai-datacenter-infra",
    order: 12,
    icon: "🧊",
    name: "AI 데이터센터 인프라",
    heat: "VERY HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "한화에어로스페이스", code: "012450", tip: "데이터센터 전력·냉각 엔지니어링 확장" },
      { name: "LG전자", code: "066570", tip: "HVAC·열관리 솔루션 역량" },
      { name: "LS ELECTRIC", code: "010120", tip: "데이터센터 전력 자동화·배전" },
      { name: "삼성전자", code: "005930", tip: "서버 메모리·스토리지 공급 핵심" },
      { name: "SK하이닉스", code: "000660", tip: "AI 서버 HBM 메모리 핵심" }
    ],
    hidden: [
      { name: "누리플렉스", code: "040160", tip: "전력 모니터링·AMI 운영 솔루션" },
      { name: "피에스텍", code: "002230", tip: "전력 계측·인프라 운영 부품" },
      { name: "이오테크닉스", code: "039030", tip: "반도체 공정 장비로 서버 공급망 연계" },
      { name: "리노공업", code: "058470", tip: "서버용 반도체 테스트 인터페이스" },
      { name: "테크윙", code: "089030", tip: "메모리 테스트 장비 수요 연동" }
    ]
  },
  {
    id: "power-semiconductor-electronics",
    order: 13,
    icon: "🔌",
    name: "전력반도체 / 전력전자",
    heat: "HOT",
    sections: ["수요단", "생산단", "부품단"],
    top: [
      { name: "DB하이텍", code: "000990", tip: "전력·아날로그 반도체 생산 기반" },
      { name: "LX세미콘", code: "108320", tip: "전력관리 IC·반도체 설계 역량" },
      { name: "서울반도체", code: "046890", tip: "전력효율 광반도체 응용" },
      { name: "원익IPS", code: "240810", tip: "전력반도체 공정 장비 공급" },
      { name: "유진테크", code: "084370", tip: "반도체 열처리·전공정 장비" }
    ],
    hidden: [
      { name: "하나머티리얼즈", code: "166090", tip: "반도체 부품·소재 공급" },
      { name: "원익QnC", code: "074600", tip: "소재·부품 기반 공정 안정화" },
      { name: "티씨케이", code: "064760", tip: "공정 핵심 소재 부품" },
      { name: "SK아이이테크놀로지", code: "361610", tip: "절연·소재 기술 기반 응용" },
      { name: "솔브레인", code: "357780", tip: "전력반도체 연계 화학 소재" }
    ]
  }
];
