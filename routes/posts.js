// routes/posts.js
// routes/posts.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');

module.exports = (pool) => {

    // [수정] 1. 모든 게시글 조회 API (페이지네이션 적용)
    router.get('/', async (req, res) => {
        // 쿼리 파라미터에서 page와 limit 값을 받습니다. 없으면 기본값을 사용합니다.
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '5', 10);
        const offset = (page - 1) * limit;

        try {
            // 두 개의 쿼리를 동시에 실행합니다.
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

    // 2. 특정 게시글 조회 API (변경 없음)
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

    // 3. 새 게시글 작성 API (변경 없음)
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

    // 4. 게시글 수정 API (변경 없음)
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

    // 5. 게시글 삭제 API (변경 없음)
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

    return router;
};

