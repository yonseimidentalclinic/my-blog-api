// routes/comments.js

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

        try {
            const result = await pool.query(
                'SELECT * FROM comments WHERE "postId" = $1 ORDER BY "createdAt" ASC',
                [postId]
            );
            res.status(200).json(result.rows);
        } catch (error) {
            // [수정] 더 자세한 에러 로깅 및 응답
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

        // authMiddleware가 정상적으로 작동했는지 확인
        if (!req.user || !req.user.id) {
            console.error('인증 미들웨어 에러: req.user 정보가 없습니다.');
            return res.status(500).json({ message: '서버 내부 에러: 사용자 정보를 확인할 수 없습니다.'});
        }
        
        const userId = req.user.id;
        const authorUsername = req.user.username;

        try {
            const result = await pool.query(
                'INSERT INTO comments (content, "postId", "userId", "authorUsername") VALUES ($1, $2, $3, $4) RETURNING *',
                [content, postId, userId, authorUsername]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            // [수정] 더 자세한 에러 로깅 및 응답
            console.error('댓글 작성 SQL 에러:', error);
            
            // Foreign Key 위반 에러(존재하지 않는 게시글)인지 확인
            if (error.code === '23503') { // PostgreSQL의 foreign_key_violation 에러 코드
                return res.status(404).json({ message: 'Error: 존재하지 않는 게시글에는 댓글을 작성할 수 없습니다.', error: error.message });
            }
            
            res.status(500).json({ message: '서버 내부 에러: 댓글을 작성할 수 없습니다.', error: error.message });
        }
    });

    return router;
};
