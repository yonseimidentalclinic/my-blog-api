// routes/comments.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // [수정] mergeParams: true 옵션 추가
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {
    // 특정 게시글의 모든 댓글 조회 (경로: /) - 누구나 가능
    router.get('/', async (req, res) => {
        const { postId } = req.params; // 주소에서 postId를 가져옴
         try {
            const result = await pool.query(
                'SELECT * FROM comments WHERE "postId" = $1 ORDER BY "createdAt" ASC',
                [postId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 특정 게시글에 새 댓글 작성 (경로: /) - 로그인한 사용자만 가능
    router.post('/', authMiddleware, async (req, res) => {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id; // 인증된 사용자의 id

        if (!content) {
            return res.status(400).json({ message: '댓글 내용은 필수입니다.' });
        }

        try {
            const result = await pool.query(
                'INSERT INTO comments (content, "userId", "postId") VALUES ($1, $2, $3) RETURNING *',
                [content, userId, postId]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }); 

    return router;
};