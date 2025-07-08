// index.js (오류 추적 디버깅용 - 수정)
require('dotenv').config();
const express = require('express');
const cors =require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                "imageUrl" VARCHAR(255),
                "userId" INTEGER NOT NULL,
                "authorUsername" VARCHAR(255) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "likeCount" INTEGER DEFAULT 0,
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE
            );
        `);
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
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                "userId" INTEGER NOT NULL,
                "postId" INTEGER NOT NULL,
                PRIMARY KEY ("userId", "postId"),
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY ("postId") REFERENCES posts (id) ON DELETE CASCADE
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS post_tags (
                "postId" INTEGER NOT NULL,
                "tagId" INTEGER NOT NULL,
                PRIMARY KEY ("postId", "tagId"),
                FOREIGN KEY ("postId") REFERENCES posts (id) ON DELETE CASCADE,
                FOREIGN KEY ("tagId") REFERENCES tags (id) ON DELETE CASCADE
            );
        `);
        console.log('PostgreSQL 데이터베이스 테이블들이 성공적으로 확인 및 수정되었습니다.');
    } catch (err) {
        console.error('데이터베이스 초기화 실패:', err.message);
    } finally {
        client.release();
    }
};
initializeDatabase().catch(err => console.error('초기화 프로세스 에러:', err));

const corsOptions = {
  origin: [process.env.CORS_ORIGIN || 'https://my-blog-frontend-one.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// =================================================================
// ========================= 디버깅 시작 =========================
// 아래 라우트들을 순서대로 하나씩 주석 해제하며 어떤 라인에서 오류가 발생하는지 확인합니다.
// =================================================================

// 1. 모든 라우트 파일을 불러옵니다.
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const likesRoutes = require('./routes/likes');
const uploadRoutes = require('./routes/upload');

// 2. 라우트를 하나씩 연결하며 테스트합니다.
// [1단계] 우선 아래 usersRoutes만 활성화하고 배포해서 성공하는지 확인합니다.
app.use('/api/users', usersRoutes(pool));

// [2단계] 1단계가 성공하면, 아래 postsRoutes의 주석을 풀고 다시 배포합니다.
// app.use('/api/posts', postsRoutes(pool));

// [3단계] 2단계가 성공하면, 아래 commentsRoutes의 주석을 풀고 다시 배포합니다.
// app.use('/api/comments', commentsRoutes(pool));

// [4단계] 3단계가 성공하면, 아래 searchRoutes의 주석을 풀고 다시 배포합니다.
// app.use('/api/search', searchRoutes(pool));

// [5단계] 4단계가 성공하면, 아래 likesRoutes의 주석을 풀고 다시 배포합니다.
// app.use('/api/likes', likesRoutes(pool));

// [6단계] 5단계가 성공하면, 마지막으로 uploadRoutes의 주석을 풀고 다시 배포합니다.
// (주의: 이 라인에는 (pool)이 없습니다!)
// app.use('/api/upload', uploadRoutes);

// ========================= 디버깅 끝 =========================
// =================================================================


app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
