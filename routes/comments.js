// routes/comments.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {

    // 1. 특정 게시글의 모든 댓글 조회 API
    router.get('/', async (req, res) => {
        const { postId } = req.query;

        if (!postId) {
            return res.status(400).json({ message: 'Error: postId가 쿼리에서 누락되었습니다.' });
        }

        // [추가] postId를 정수형으로 변환하고, 유효한 숫자인지 확인합니다.
        const postIdNum = parseInt(postId, 10);
        if (isNaN(postIdNum)) {
            return res.status(400).json({ message: 'Error: postId는 유효한 숫자여야 합니다.' });
        }

        try {
            const result = await pool.query(
                'SELECT * FROM comments WHERE "postId" = $1 ORDER BY "createdAt" ASC',
                [postIdNum] // [수정] 변환된 숫자를 사용합니다.
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('댓글 조회 SQL 에러:', error);
            res.status(500).json({ message: '서버 내부 에러: 댓글을 조회할 수 없습니다.', error: error.message });
        }
    });

    // 2. 새 댓글 작성 API (인증 필요)
    router.post('/', authMiddleware, async (req, res) => {
        const { content, postId } = req.body;
        
        if (!content || !postId) {
            return res.status(400).json({ message: 'Error: 내용과 postId는 필수입니다.' });
        }

        // [추가] postId를 정수형으로 변환하고, 유효한 숫자인지 확인합니다.
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
                [content, postIdNum, userId, authorUsername] // [수정] 변환된 숫자를 사용합니다.
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

    return router;
};


