// routes/users.js (오류 추적 디버깅용)
const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // 가장 간단한 테스트용 API
    router.get('/test', (req, res) => {
        res.status(200).send('Users route is working!');
    });

    return router;
};
