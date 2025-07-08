// index.js (최종 환경 테스트용)
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// routes 폴더의 어떤 파일도 불러오지 않습니다.
// 오직 이 파일 안에서 모든 것을 처리합니다.

app.get('/', (req, res) => {
    res.status(200).json({ message: '서버가 성공적으로 실행되었습니다! 오류가 해결되었습니다!' });
});

app.get('/api/test', (req, res) => {
    res.status(200).json({ message: '테스트 API가 정상적으로 작동합니다.' });
});


app.listen(port, () => {
    console.log(`최종 테스트 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
