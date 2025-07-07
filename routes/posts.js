// routes/posts.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {

    // 1. 모든 게시글 조회 API (페이지네이션 적용)
    router.get('/', async (req, res) => {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '5', 10);
        const offset = (page - 1) * limit;

        try {
            const postsResultPromise = pool.query(
                'SELECT * FROM posts ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            const totalResultPromise = pool.query('SELECT COUNT(*) FROM posts');

            const [postsResult, totalResult] = await Promise.all([postsResultPromise, totalResultPromise]);
            
            const totalPosts = parseInt(totalResult.rows[0].count, 10);
            const totalPages = Math.ceil(totalPosts / limit);

            res.status(200).json({
                posts: postsResult.rows,
                totalPages: totalPages,
                currentPage: page,
                totalPosts: totalPosts
            });

        } catch (error) {
            console.error('게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 2. 특정 게시글 조회 API
    router.get('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
            }
            res.status(200).json(result.rows[0]);
        } catch (error) {
            console.error('특정 게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 3. 새 게시글 작성 API
    router.post('/', authMiddleware, async (req, res) => {
        const { title, content, imageUrl } = req.body;
        const userId = req.user.id;
        const authorUsername = req.user.username;

        if (!title || !content) {
            return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
        }

        try {
            const result = await pool.query(
                'INSERT INTO posts (title, content, "imageUrl", "userId", "authorUsername") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [title, content, imageUrl, userId, authorUsername]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('게시글 작성 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 4. 게시글 수정 API
    router.put('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { title, content } = req.body;
        const currentUserId = req.user.id;

        if (!title || !content) {
            return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
        }

        try {
            const postResult = await pool.query('SELECT "userId" FROM posts WHERE id = $1', [id]);
            if (postResult.rows.length === 0) {
                return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
            }

            const post = postResult.rows[0];
            if (post.userId !== currentUserId) {
                return res.status(403).json({ message: '이 게시글을 수정할 권한이 없습니다.' });
            }

            const updateResult = await pool.query(
                'UPDATE posts SET title = $1, content = $2 WHERE id = $3 RETURNING *',
                [title, content, id]
            );
            res.status(200).json(updateResult.rows[0]);
        } catch (error) {
            console.error('게시글 수정 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 5. 게시글 삭제 API
    router.delete('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const currentUserId = req.user.id;

        try {
            const postResult = await pool.query('SELECT "userId" FROM posts WHERE id = $1', [id]);
            if (postResult.rows.length === 0) {
                return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
            }

            const post = postResult.rows[0];
            if (post.userId !== currentUserId) {
                return res.status(403).json({ message: '이 게시글을 삭제할 권한이 없습니다.' });
            }

            await pool.query('DELETE FROM posts WHERE id = $1', [id]);
            res.status(200).json({ message: '게시글이 성공적으로 삭제되었습니다.' });
        } catch (error) {
            console.error('게시글 삭제 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // [최종 수정] 6. 좋아요/좋아요 취소 API
    router.post('/:id/like', authMiddleware, async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        if (isNaN(postId)) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID입니다.' });
        }
        const userId = req.user.id;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. 게시글이 존재하는지, 현재 좋아요 수는 몇 개인지 먼저 확인합니다.
            const postResult = await client.query('SELECT "likeCount" FROM posts WHERE id = $1', [postId]);
            if (postResult.rows.length === 0) {
                throw new Error('게시글을 찾을 수 없습니다.');
            }
            // likeCount가 NULL이면 0으로 처리하여 안정성을 높입니다.
            let currentLikeCount = postResult.rows[0].likeCount || 0;

            // 2. 사용자가 이미 좋아요를 눌렀는지 확인합니다.
            const likeResult = await client.query('SELECT * FROM likes WHERE "userId" = $1 AND "postId" = $2', [userId, postId]);

            if (likeResult.rows.length > 0) {
                // 이미 좋아요를 눌렀으면 -> 좋아요 취소
                await client.query('DELETE FROM likes WHERE "userId" = $1 AND "postId" = $2', [userId, postId]);
                // 현재 좋아요 수에서 1을 뺀 값으로 업데이트합니다.
                await client.query('UPDATE posts SET "likeCount" = $1 WHERE id = $2', [currentLikeCount - 1, postId]);
            } else {
                // 좋아요를 누르지 않았으면 -> 좋아요 추가
                await client.query('INSERT INTO likes ("userId", "postId") VALUES ($1, $2)', [userId, postId]);
                // 현재 좋아요 수에서 1을 더한 값으로 업데이트합니다.
                await client.query('UPDATE posts SET "likeCount" = $1 WHERE id = $2', [currentLikeCount + 1, postId]);
            }

            await client.query('COMMIT'); // 모든 작업이 성공하면 최종 저장
            res.status(200).json({ message: '좋아요 상태가 변경되었습니다.' });

        } catch (error) {
            await client.query('ROLLBACK'); // 하나라도 실패하면 모든 작업을 되돌립니다.
            console.error('좋아요 API 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.', error: error.message });
        } finally {
            client.release(); // 데이터베이스 연결을 반환합니다.
        }
    });

    return router;
};
