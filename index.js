// index.js (CORS 오류 최종 해결)
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

// 데이터베이스 초기화 함수
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

// [CORS 수정] 환경 변수 대신, 허용할 주소를 코드에 직접 명시합니다.
const corsOptions = {
  origin: [
      'https://my-blog-frontend-one.vercel.app', 
      'http://localhost:5173', 
      'http://127.0.0.1:5173'
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// 모든 라우트 파일을 불러옵니다.
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const likesRoutes = require('./routes/likes');
const uploadRoutes = require('./routes/upload');


// 모든 API 라우트를 연결합니다.
app.use('/api/users', usersRoutes(pool));
app.use('/api/posts', postsRoutes(pool));
app.use('/api/comments', commentsRoutes(pool));
app.use('/api/search', searchRoutes(pool));
app.use('/api/likes', likesRoutes(pool));
app.use('/api/upload', uploadRoutes);


app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
