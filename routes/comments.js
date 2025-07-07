// routes/comments.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {

    // 1. 특정 게시글의 모든 댓글 조회 API
    // 예: GET /api/comments?postId=1
    router.get('/', async (req, res) => {
        const { postId } = req.query;

        if (!postId) {
            return res.status(400).json({ message: 'Error: postId가 필요합니다.' });
        }

        const postIdNum = parseInt(postId, 10);
        if (isNaN(postIdNum)) {
            return res.status(400).json({ message: 'Error: postId는 유효한 숫자여야 합니다.' });
        }

        try {
            const result = await pool.query(
                'SELECT * FROM comments WHERE "postId" = $1 ORDER BY "createdAt" ASC',
                [postIdNum]
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('댓글 조회 SQL 에러:', error);
            res.status(500).json({ message: '서버 내부 에러: 댓글을 조회할 수 없습니다.', error: error.message });
        }
    });

    // 2. 새 댓글 작성 API (인증 필요)
    // 예: POST /api/comments
    router.post('/', authMiddleware, async (req, res) => {
        const { content, postId } = req.body;
        
        if (!content || !postId) {
            return res.status(400).json({ message: 'Error: 내용과 postId는 필수입니다.' });
        }

        const postIdNum = parseInt(postId, 10);
        if (isNaN(postIdNum)) {
            return res.status(400).json({ message: 'Error: postId는 유효한 숫자여야 합니다.' });
        }

        if (!req.user || !req.user.id) {
            console.error('인증 미들웨어 에러: req.user 정보가 없습니다.');
            return res.status(500).json({ message: '서버 내부 에러: 사용자 정보를 확인할 수 없습니다.'});
        }
        
        const userId = req.user.id;
        const authorUsername = req.user.username;

        try {
            const result = await pool.query(
                'INSERT INTO comments (content, "postId", "userId", "authorUsername") VALUES ($1, $2, $3, $4) RETURNING *',
                [content, postIdNum, userId, authorUsername]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('댓글 작성 SQL 에러:', error);
            if (error.code === '23503') { 
                return res.status(404).json({ message: 'Error: 존재하지 않는 게시글에는 댓글을 작성할 수 없습니다.', error: error.message });
            }
            res.status(500).json({ message: '서버 내부 에러: 댓글을 작성할 수 없습니다.', error: error.message });
        }
    });

    // 3. 댓글 삭제 API (인증 필요)
    router.delete('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const currentUserId = req.user.id;

        try {
            const commentResult = await pool.query('SELECT "userId" FROM comments WHERE id = $1', [id]);
            if (commentResult.rows.length === 0) {
                return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });
            }

            const comment = commentResult.rows[0];
            if (comment.userId !== currentUserId) {
                return res.status(403).json({ message: '이 댓글을 삭제할 권한이 없습니다.' });
            }

            await pool.query('DELETE FROM comments WHERE id = $1', [id]);
            res.status(200).json({ message: '댓글이 성공적으로 삭제되었습니다.' });

        } catch (error) {
            console.error('댓글 삭제 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.', error: error.message });
        }
    });

    return router;
};
