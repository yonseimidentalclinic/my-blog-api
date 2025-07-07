// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// [최종 수정] 데이터베이스 테이블을 강제로 재생성하여 스키마를 바로잡습니다.
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        // 기존 테이블을 모두 삭제하여 깨끗한 상태에서 시작합니다.
        // CASCADE 옵션은 posts를 참조하는 다른 테이블의 제약조건도 함께 삭제합니다.
        await client.query('DROP TABLE IF EXISTS posts CASCADE;');
        await client.query('DROP TABLE IF EXISTS comments CASCADE;');
        await client.query('DROP TABLE IF EXISTS likes CASCADE;');
        await client.query('DROP TABLE IF EXISTS users CASCADE;');

        // users 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);
        
        // posts 테이블 생성 (올바른 스키마)
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

        // comments 테이블 생성
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

        // likes 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                "userId" INTEGER NOT NULL,
                "postId" INTEGER NOT NULL,
                PRIMARY KEY ("userId", "postId"),
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY ("postId") REFERENCES posts (id) ON DELETE CASCADE
            );
        `);
        
        console.log('PostgreSQL의 모든 테이블이 성공적으로 재생성되었습니다.');
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

// --- 라우터 설정 ---
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const likesRoutes = require('./routes/likes');
const uploadRoutes = require('./routes/upload');

app.use('/api/users', usersRoutes(pool));
app.use('/api/posts', postsRoutes(pool));
app.use('/api/comments', commentsRoutes(pool));
app.use('/api/search', searchRoutes(pool));
app.use('/api/likes', likesRoutes(pool));
app.use('/api/upload', uploadRoutes);

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
