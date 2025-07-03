require('dotenv').config(); // .env 파일의 변수를 환경변수로 로드
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // pg 패키지 사용
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const multer = require('multer'); // [추가] multer 불러오기
const path = require('path'); // [추가] Node.js 내장 모듈
const postsRouterFn = require('./routes/posts');
const usersRouterFn = require('./routes/users'); 
const commentsRouterFn = require('./routes/comments'); 
const app = express();
const port =process.env.PORT || 3000;

// DB Connection Pool 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors()); 
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// --- Multer 설정 (파일 업로드) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // 파일이 저장될 경로
    },
    filename: function (req, file, cb) {
        // 파일 이름 중복 방지를 위해 'fieldname-타임스탬프.확장자' 형태로 저장
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 데이터베이스 연결 설정을 위한 비동기 함수
async function setupDatabaseAndStartServer() {

     const createTablesQuery = `
    // 1. users 테이블 먼저 생성
    
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

    app.get('/', (req, res) => { res.send('나의 첫 배포된 API 서버!'); });
    
    // 라우터에 DB connection pool 전달
    app.use('/api/posts', require('./routes/posts')(pool));
    app.use('/api/users', require('./routes/users')(pool));
    app.use('/api/posts/:postId/comments', require('./routes/comments')(pool));
     


       // [추가] 이미지 업로드 전용 API
    // 'image'는 프론트엔드에서 보낼 때 사용할 key 값입니다.
    app.post('/api/upload', upload.single('image'), (req, res) => {
        if (!req.file) {
            return res.status(400).send('이미지 파일이 없습니다.');
        }
        // 업로드 성공 시, 이미지 파일의 URL 경로를 응답으로 보냄
        res.json({ imageUrl: `/uploads/${req.file.filename}` });
    });


    // 기본 환영 메시지 API
    app.get('/', (req, res) => {
        res.send('나의 첫 데이터베이스 기반 API 서버!');
    });

    // 라우터 연결
    const postsRouter = require('./routes/posts')(db);
    app.use('/api/posts', postsRouter);

    const usersRouter = require('./routes/users')(db);
    app.use('/api/users', usersRouter);

    const commentsRouter = commentsRouterFn(db);
    // '/api/posts/:postId/comments' 경로로 들어오는 요청을 commentsRouter에게 넘겨줍니다.
    app.use('/api/posts/:postId/comments', commentsRouter);

    // 서버 실행
    app.listen(port, () => {
        console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
        console.log('데이터베이스가 성공적으로 연결되었습니다.');
    });
}

// 위에서 정의한 비동기 함수를 실행합니다.
setupDatabaseAndStartServer();