// routes/comments.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {
    // 특정 게시글의 모든 댓글 조회
    router.get('/', async (req, res) => {
        const { postId } = req.params;
        try {
            const result = await pool.query(
                'SELECT c.*, u.username FROM comments c JOIN users u ON c."userId" = u.id WHERE c."postId" = $1 ORDER BY c."createdAt" ASC',
                [postId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Get Comments Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 특정 게시글에 새 댓글 작성
    router.post('/', authMiddleware, async (req, res) => {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
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
            console.error('Create Comment Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};