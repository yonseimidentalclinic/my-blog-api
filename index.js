require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ message: '최소 기능 서버가 성공적으로 실행되었습니다!' });
});

app.listen(port, () => {
    console.log(`최소 기능 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
