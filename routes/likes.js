// routes/likes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {

    // 현재 로그인한 사용자가 '좋아요' 누른 모든 게시글 ID 조회 API
    // GET /api/likes
    router.get('/', authMiddleware, async (req, res) => {
        const userId = req.user.id;

        try {
            const result = await pool.query(
                'SELECT "postId" FROM likes WHERE "userId" = $1',
                [userId]
            );
            // 결과 배열을 [3, 15, 23] 과 같은 숫자 배열 형태로 변환하여 반환
            const likedPostIds = result.rows.map(row => row.postId);
            res.status(200).json(likedPostIds);
        } catch (error) {
            console.error('좋아요 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
