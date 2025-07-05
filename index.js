// index.js
require('dotenv').config(); // .env 파일의 변수를 환경변수로 로드
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('./authMiddleware');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL DB Connection Pool 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 데이터베이스 스키마 초기화 함수
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        // users 테이블
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);
        // posts 테이블
        await client.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                "imageUrl" VARCHAR(255),
                "userId" INTEGER NOT NULL,
                "authorUsername" VARCHAR(255) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        // comments 테이블
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                "postId" INTEGER NOT NULL,
                "userId" INTEGER NOT NULL,
                "authorUsername" VARCHAR(255) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("postId") REFERENCES posts (id) ON DELETE CASCADE,
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        console.log('PostgreSQL 데이터베이스가 성공적으로 연결 및 초기화되었습니다.');
    } catch (err) {
        console.error('데이터베이스 초기화 실패:', err.message);
    } finally {
        client.release();
    }
};

// 서버 시작 시 데이터베이스 초기화 실행
initializeDatabase().catch(err => console.error('초기화 프로세스 에러:', err));

// [수정] CORS 설정
// .env 파일에 프론트엔드 주소를 설정하는 것이 좋습니다. 예: CORS_ORIGIN=https://my-blog-frontend-one.vercel.app
const corsOptions = {
  origin: [process.env.CORS_ORIGIN || 'https://my-blog-frontend-one.vercel.app', 'http://localhost:5173'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// 미들웨어
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer 설정 (파일 업로드)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// --- 라우터 설정 ---

// 이미지 업로드 API
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }
    res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
});

// [정리] 라우터에 DB connection pool 전달
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments'); 

app.use('/api/users', usersRoutes(pool));
app.use('/api/posts', postsRoutes(pool));
app.use('/api/comments', commentsRoutes(pool)); 

/*
// [참고] 아래 라우트들은 각 파일이 준비되면 주석을 해제하여 사용하세요.
// 서버가 시작될 때 해당 파일이 없으면 에러가 발생합니다.
app.use('/api/auth', require('./routes/auth')(pool));
app.use('/api/profile', authMiddleware, require('./routes/profile')(pool));
app.use('/api/search', require('./routes/search')(pool));
app.use('/api/notifications', authMiddleware, require('./routes/notifications')(pool));
app.use('/api/likes', authMiddleware, require('./routes/likes')(pool));
app.use('/api/follow', authMiddleware, require('./routes/follow')(pool));
app.use('/api/analytics', authMiddleware, require('./routes/analytics')(pool));
app.use('/api/admin', authMiddleware, require('./routes/admin')(pool));
*/

// 서버 시작
app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});

// [삭제] 정의되지 않은 함수 호출로 에러를 유발하므로 이 라인은 제거했습니다.
