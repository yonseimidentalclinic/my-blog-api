// index.js (PostgreSQL 최종 버전)
require('dotenv').config(); // .env 파일의 변수를 환경변수로 로드
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // sqlite3 대신 pg 사용
const multer = require('multer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;



// DB Connection Pool 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 로컬에서 Render DB 접속 시 SSL 옵션이 필요할 수 있습니다.
  ssl: {
    rejectUnauthorized: false
  }
});

// CORS 설정: Vercel 프론트엔드 주소를 명시적으로 허용
const corsOptions = {
 origin: process.env.CORS_ORIGIN, 
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
 

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Multer 설정 (파일 업로드)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

async function setupDatabaseAndStartServer() {
    // 테이블 생성 SQL (PostgreSQL 문법)
    const createTablesQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            "imageUrl" VARCHAR(255),
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "userId" INTEGER REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "userId" INTEGER REFERENCES users(id),
            "postId" INTEGER REFERENCES posts(id)
        );
    `;
    await pool.query(createTablesQuery);

    app.get('/', (req, res) => { res.send('API 서버 v2 - 최종 버전이 배포되었습니다!'); });
   
     // ▼▼▼ 새로운 진단용 API 추가 ▼▼▼
    app.get('/test-deploy', (req, res) => {
        res.send('SUCCESS! The latest version is deployed.');
    });
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // 이미지 업로드 전용 API
    app.post('/api/upload', upload.single('image'), (req, res) => {
        if (!req.file) {
            return res.status(400).send('이미지 파일이 없습니다.');
        }
        res.json({ imageUrl: `/uploads/${req.file.filename}` });
    });
    
    // 라우터에 DB connection pool 전달
    app.use('/api/posts', require('./routes/posts')(pool));
    app.use('/api/users', require('./routes/users')(pool));
    app.use('/api/posts/:postId/comments', require('./routes/comments')(pool));
    
    app.listen(port, () => {
        console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
        console.log('데이터베이스가 성공적으로 연결되었습니다.');
    });
}

setupDatabaseAndStartServer().catch(err => console.error(err));