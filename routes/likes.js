const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {
    router.get('/', authMiddleware, async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await pool.query(
                'SELECT "postId" FROM likes WHERE "userId" = $1',
                [userId]
            );
            const likedPostIds = result.rows.map(row => row.postId);
            res.status(200).json(likedPostIds);
        } catch (error) {
            console.error('좋아요 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });
    return router;
};
