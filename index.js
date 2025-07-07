// index.js (디버깅용 버전)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');

// --- 필수 환경 변수 확인 ---
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    console.error("치명적 에러: DATABASE_URL과 JWT_SECRET 환경 변수가 .env 파일에 설정되어야 합니다.");
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

/*
// [디버깅] 데이터베이스 연결을 잠시 비활성화합니다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initializeDatabase = async () => {
    // ... DB 초기화 코드 ...
};

// [디버깅] 데이터베이스 초기화 함수 호출을 주석 처리합니다.
// initializeDatabase();
*/

console.log(">>> 서버 설정 시작");

// --- CORS 설정 ---
const corsOptions = {
  origin: [process.env.CORS_ORIGIN || 'https://my-blog-frontend-one.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// 기본 미들웨어
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// [디버깅] 서버가 살아있는지 확인하기 위한 기본 테스트 라우트
app.get('/', (req, res) => {
    console.log(">>> 루트 경로 (/) 요청 수신");
    res.status(200).send('서버가 성공적으로 실행되었습니다!');
});


// --- API 라우터 ---
// [디버깅] 데이터베이스를 사용하지 않으므로 모든 API 라우터를 잠시 주석 처리합니다.
/*
function authMiddleware(req, res, next) {
    // ... 인증 미들웨어 코드 ...
}
// 사용자 (Users) API
app.post('/api/users/register', ...);
// ... (이하 모든 API 라우터) ...
app.post('/api/upload', ...);
*/

// --- 중앙 집중식 오류 처리 미들웨어 ---
app.use((err, req, res, next) => {
    console.error("예상치 못한 에러 발생:", err.stack);
    res.status(500).json({ message: '서버 내부에서 오류가 발생했습니다.' });
});

// 서버 시작
app.listen(port, () => {
    // 이 로그가 Render 로그에 나타나야 합니다.
    console.log(`>>> 서버가 포트 ${port}에서 성공적으로 시작되었습니다.`);
    console.log(`>>> Health Check 대기 중...`);
});

console.log(">>> 서버 설정 완료, 리스닝 시작 직전");
