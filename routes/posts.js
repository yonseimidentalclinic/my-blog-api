// routes/posts.js
// routes/posts.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {
    // 모든 게시글 조회
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT p.*, u.username FROM posts p JOIN users u ON p."userId" = u.id ORDER BY p."createdAt" DESC`
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Get All Posts Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 새 게시글 작성
    router.post('/', authMiddleware, async (req, res) => {
        const { title, content, imageUrl } = req.body;
        const userId = req.user.id;
        try {
            const result = await pool.query(
                'INSERT INTO posts (title, content, "userId", "imageUrl") VALUES ($1, $2, $3, $4) RETURNING *',
                [title, content, userId, imageUrl]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Create Post Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 게시글 수정
    router.put('/:id', authMiddleware, async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        const { title, content } = req.body;
        const userId = req.user.id;
        try {
            const postResult = await pool.query('SELECT "userId" FROM posts WHERE id = $1', [postId]);
            if (postResult.rows.length === 0) return res.status(404).send('게시글을 찾을 수 없습니다.');
            if (postResult.rows[0].userId !== userId) return res.status(403).send('권한이 없습니다.');
            
            const result = await pool.query(
                'UPDATE posts SET title = $1, content = $2 WHERE id = $3 RETURNING *',
                [title, content, postId]
            );
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update Post Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 게시글 삭제
    router.delete('/:id', authMiddleware, async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        const userId = req.user.id;
        try {
            const postResult = await pool.query('SELECT "userId" FROM posts WHERE id = $1', [postId]);
            if (postResult.rows.length === 0) return res.status(404).send('게시글을 찾을 수 없습니다.');
            if (postResult.rows[0].userId !== userId) return res.status(403).send('권한이 없습니다.');

            await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
            res.status(200).send('게시글이 성공적으로 삭제되었습니다.');
        } catch (error) {
            console.error('Delete Post Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};