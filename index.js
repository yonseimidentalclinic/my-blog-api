// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const authMiddleware = require('./authMiddleware');



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
                "likeCount" INTEGER DEFAULT 0, -- [추가] 좋아요 개수 컬럼
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE
            );
        `);

        // [정리 완료] 테이블 재생성 코드를 삭제하여 데이터가 보존되도록 합니다.

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
    
             // [추가] 좋아요 테이블 생성
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                "userId" INTEGER NOT NULL,
                "postId" INTEGER NOT NULL,
                PRIMARY KEY ("userId", "postId"), -- 한 사용자는 한 게시글에 한 번만 좋아요 가능
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY ("postId") REFERENCES posts (id) ON DELETE CASCADE
            );
        `);


        console.log('PostgreSQL 데이터베이스가 성공적으로 연결 및 초기화되었습니다.');
    } catch (err) {
        console.error('데이터베이스 초기화 실패:', err.message);
    } finally {
        client.release();
    }
};

initializeDatabase().catch(err => console.error('초기화 프로세스 에러:', err));

const corsOptions = {
  origin: [process.env.CORS_ORIGIN || 'https://my-blog-frontend-one.vercel.app', 'http://localhost:5173','http://127.0.0.1:5173'],

  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const likesRoutes = require('./routes/likes');
const uploadRoutes = require('./routes/upload'); 


app.use('/api/users', usersRoutes(pool));
app.use('/api/posts', postsRoutes(pool));
app.use('/api/comments', commentsRoutes(pool));
// index.js 파일 하단의 다른 app.use들과 함께 추가
app.use('/api/search', searchRoutes(pool));
app.use('/api/likes', likesRoutes(pool));
app.use('/api/upload', uploadRoutes(pool)); // 업로드 라우트 추가

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
