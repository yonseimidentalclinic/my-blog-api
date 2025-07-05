// routes/comments.js

const express = require('express');
const router = express.Router();
// [수정] authMiddleware 경로를 현재 파일 위치 기준으로 ../authMiddleware 로 명확히 합니다.
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {

    // 1. 특정 게시글의 모든 댓글 조회 API
    // 예: GET /api/comments?postId=1
    router.get('/', async (req, res) => {
        const { postId } = req.query; // 쿼리 파라미터에서 postId를 받습니다.

        if (!postId) {
            return res.status(400).json({ message: 'postId가 필요합니다.' });
        }

        try {
            const result = await pool.query(
                'SELECT * FROM comments WHERE "postId" = $1 ORDER BY "createdAt" ASC',
                [postId]
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('댓글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 2. 새 댓글 작성 API (인증 필요)
    // 예: POST /api/comments
    router.post('/', authMiddleware, async (req, res) => {
        const { content, postId } = req.body;
        const userId = req.user.id;
        const authorUsername = req.user.username;

        if (!content || !postId) {
            return res.status(400).json({ message: '내용과 postId는 필수입니다.' });
        }

        try {
            const result = await pool.query(
                'INSERT INTO comments (content, "postId", "userId", "authorUsername") VALUES ($1, $2, $3, $4) RETURNING *',
                [content, postId, userId, authorUsername]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('댓글 작성 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};


