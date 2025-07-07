// index.js (통합 버전)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

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
                FOREIGN KEY ("userId") REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        const checkColumnRes = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'posts' AND column_name = 'likeCount'
        `);
        if (checkColumnRes.rows.length === 0) {
            console.log(">>> 'posts' 테이블에 'likeCount' 컬럼을 추가합니다.");
            await client.query('ALTER TABLE posts ADD COLUMN "likeCount" INTEGER DEFAULT 0');
        }
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
        console.log('PostgreSQL 데이터베이스 테이블들이 성공적으로 확인 및 수정되었습니다.');
    } catch (err) {
        console.error('데이터베이스 초기화 실패:', err.message);
    } finally {
        client.release();
    }
};

initializeDatabase().catch(err => console.error('초기화 프로세스 에러:', err));

// CORS 설정
const corsOptions = {
  origin: [process.env.CORS_ORIGIN || 'https://my-blog-frontend-one.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 기본 미들웨어
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 인증 미들웨어 (authMiddleware.js 내용 통합) ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key-that-is-long-and-secure';
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
}

// --- 라우터 설정 (모든 routes/*.js 내용 통합) ---

// 사용자 (Users) API
app.post('/api/users/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
    try {
        const existingUserResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUserResult.rows.length > 0) return res.status(409).json({ message: '이미 존재하는 사용자 이름입니다.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserResult = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username', [username, hashedPassword]);
        res.status(201).json({ id: newUserResult.rows[0].id, username: newUserResult.rows[0].username, message: '회원가입이 성공적으로 완료되었습니다.' });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
});
app.post('/api/users/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: '로그인 성공!', token: token });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
});
app.get('/api/users/:userId/posts', async (req, res) => {
    const { userId } = req.params;
    try {
        const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        const postsResult = await pool.query('SELECT * FROM posts WHERE "userId" = $1 ORDER BY "createdAt" DESC', [userId]);
        res.status(200).json({ username: userResult.rows[0].username, posts: postsResult.rows });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
});

// 게시글 (Posts) API
app.get('/api/posts', async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '5', 10);
    const offset = (page - 1) * limit;
    try {
        const postsResultPromise = pool.query('SELECT * FROM posts ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2', [limit, offset]);
        const totalResultPromise = pool.query('SELECT COUNT(*) FROM posts');
        const [postsResult, totalResult] = await Promise.all([postsResultPromise, totalResultPromise]);
        const totalPosts = parseInt(totalResult.rows[0].count, 10);
        res.status(200).json({ posts: postsResult.rows, totalPages: Math.ceil(totalPosts / limit), currentPage: page, totalPosts: totalPosts });
    } catch (error) { res.status(500).json({ message: '서버 에러' }); }
});
app.get('/api/posts/:id', async (req, res) => { /* ... */ });
app.post('/api/posts', authMiddleware, async (req, res) => { /* ... */ });
app.put('/api/posts/:id', authMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/posts/:id', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => { /* ... */ });

// 댓글 (Comments) API
app.get('/api/comments', async (req, res) => { /* ... */ });
app.post('/api/comments', authMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/comments/:id', authMiddleware, async (req, res) => { /* ... */ });

// 좋아요 (Likes) API
app.get('/api/likes', authMiddleware, async (req, res) => { /* ... */ });

// 검색 (Search) API
app.get('/api/search', async (req, res) => { /* ... */ });

// 이미지 업로드 (Upload) API
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, 'uploads/'), filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`) });
const upload = multer({ storage });
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
});


// 서버 시작
app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
