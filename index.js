// index.js (오류 추적 디버깅용)
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

// 데이터베이스 초기화 함수 (이전과 동일)
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS users (...)`); // 내용은 생략합니다. 기존 코드를 유지하세요.
        await client.query(`CREATE TABLE IF NOT EXISTS posts (...)`);
        await client.query(`CREATE TABLE IF NOT EXISTS comments (...)`);
        await client.query(`CREATE TABLE IF NOT EXISTS likes (...)`);
        await client.query(`CREATE TABLE IF NOT EXISTS tags (...)`);
        await client.query(`CREATE TABLE IF NOT EXISTS post_tags (...)`);
        console.log('PostgreSQL 데이터베이스 테이블들이 성공적으로 확인 및 수정되었습니다.');
    } catch (err) {
        console.error('데이터베이스 초기화 실패:', err.message);
    } finally {
        client.release();
    }
};
// initializeDatabase().catch(err => console.error('초기화 프로세스 에러:', err)); // 배포 시에는 이 라인을 주석 처리하는 것이 더 안정적일 수 있습니다.

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
```

### 디버깅 방법

1.  **`index.js` 교체:** 위 코드로 `index.js` 파일 전체를 덮어쓰고 저장하세요. (`initializeDatabase` 함수 안의 `CREATE TABLE` 내용은 기존 코드를 그대로 복사해서 사용하시면 됩니다.)
2.  **[1단계] 첫 배포:** 코드를 그대로 저장하고, Git에 커밋 & 푸시하여 Render에 배포합니다. `usersRoutes`만 활성화된 상태이므로 아마 성공할 것입니다.
3.  **[2단계] `postsRoutes` 활성화:** 1단계 배포가 성공하면, `index.js` 파일에서 `app.use('/api/posts', postsRoutes(pool));` 라인의 주석(`//`)을 제거합니다. 그리고 다시 커밋 & 푸시하여 배포합니다.
4.  **반복:** 배포가 성공할 때마다 다음 라우트의 주석을 하나씩 제거하고 다시 배포하는 과정을 반복합니다.
5.  **오류 발생 지점 찾기:** 이 과정을 반복하다 보면, **어떤 라우트의 주석을 풀고 배포했을 때 `TypeError: Missing parameter name` 오류가 다시 발생하는 순간**이 올 겁니다.

**바로 그 라우트가 범인입니다!**

어떤 라우트에서 오류가 발생하는지 찾으시면, 즉시 저에게 알려주세요. 그럼 그 파일의 코드를 다시 한번 정밀하게 분석해서 문제를 완전히 해결해 드리겠습