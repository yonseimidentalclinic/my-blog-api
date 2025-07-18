const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware'); 

module.exports = (pool) => {

     // [추가] '공지' 태그가 달린 최신 5개 게시글을 가져오는 API
    router.get('/notices', async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT p.id, p.title 
                 FROM posts p
                 JOIN post_tags pt ON p.id = pt."postId"
                 JOIN tags t ON pt."tagId" = t.id
                 WHERE t.name = '공지'
                 ORDER BY p."createdAt" DESC
                 LIMIT 5`
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('공지사항 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });







    router.get('/tagged/:tagName', async (req, res) => {
        const { tagName } = req.params;
        try {
            const result = await pool.query(
                `SELECT p.*, u.username as "authorUsername" 
                 FROM posts p
                 JOIN users u ON p."userId" = u.id
                 JOIN post_tags pt ON p.id = pt."postId"
                 JOIN tags t ON pt."tagId" = t.id
                 WHERE t.name = $1
                 ORDER BY p."createdAt" DESC`,
                [tagName.toLowerCase()]
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('태그별 게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    router.get('/popular', async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT * FROM posts WHERE "likeCount" > 0 ORDER BY "likeCount" DESC, "createdAt" DESC LIMIT 5'
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('인기 게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    router.get('/', async (req, res) => {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '5', 10);
        const offset = (page - 1) * limit;
        try {
            const postsResultPromise = pool.query(
                'SELECT p.*, u.username as "authorUsername" FROM posts p JOIN users u ON p."userId" = u.id ORDER BY p."createdAt" DESC LIMIT $1 OFFSET $2',
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

    router.get('/:id', async (req, res) => {
        const { id } = req.params;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const postResult = await client.query('SELECT p.*, u.username as "authorUsername" FROM posts p JOIN users u ON p."userId" = u.id WHERE p.id = $1', [id]);
            if (postResult.rows.length === 0) {
                return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
            }
            const post = postResult.rows[0];
            const tagsResult = await client.query(
                `SELECT t.name FROM tags t
                 JOIN post_tags pt ON t.id = pt."tagId"
                 WHERE pt."postId" = $1`,
                [id]
            );
            post.tags = tagsResult.rows.map(row => row.name);
            await client.query('COMMIT');
            res.status(200).json(post);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('특정 게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        } finally {
            client.release();
        }
    });

    router.post('/', authMiddleware, async (req, res) => {
        const { title, content, imageUrl, tags } = req.body;
        const userId = req.user.id;
        const authorUsername = req.user.username;
        if (!title || !content) {
            return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const postResult = await client.query(
                'INSERT INTO posts (title, content, "imageUrl", "userId", "authorUsername") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [title, content, imageUrl, userId, authorUsername]
            );
            const newPost = postResult.rows[0];
            if (tags && Array.isArray(tags) && tags.length > 0) {
                for (const tagName of tags) {
                    const cleanedTagName = tagName.trim().toLowerCase();
                    if(cleanedTagName === '') continue;
                    let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [cleanedTagName]);
                    let tagId;
                    if (tagResult.rows.length > 0) {
                        tagId = tagResult.rows[0].id;
                    } else {
                        const newTagResult = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [cleanedTagName]);
                        tagId = newTagResult.rows[0].id;
                    }
                    await client.query('INSERT INTO post_tags ("postId", "tagId") VALUES ($1, $2) ON CONFLICT DO NOTHING', [newPost.id, tagId]);
                }
            }
            await client.query('COMMIT');
            res.status(201).json(newPost);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('게시글 작성 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        } finally {
            client.release();
        }
    });

    router.put('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { title, content, imageUrl, tags } = req.body;
        const currentUserId = req.user.id;
        if (!title || !content) {
            return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const postResult = await client.query('SELECT "userId" FROM posts WHERE id = $1', [id]);
            if (postResult.rows.length === 0) {
                throw new Error('404');
            }
            if (postResult.rows[0].userId !== currentUserId) {
                throw new Error('403');
            }
            const updateResult = await client.query(
                'UPDATE posts SET title = $1, content = $2, "imageUrl" = $3 WHERE id = $4 RETURNING *',
                [title, content, imageUrl, id]
            );
            await client.query('DELETE FROM post_tags WHERE "postId" = $1', [id]);
            if (tags && Array.isArray(tags) && tags.length > 0) {
                for (const tagName of tags) {
                    const cleanedTagName = tagName.trim().toLowerCase();
                    if(cleanedTagName === '') continue;
                    let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [cleanedTagName]);
                    let tagId;
                    if (tagResult.rows.length > 0) {
                        tagId = tagResult.rows[0].id;
                    } else {
                        const newTagResult = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [cleanedTagName]);
                        tagId = newTagResult.rows[0].id;
                    }
                    await client.query('INSERT INTO post_tags ("postId", "tagId") VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tagId]);
                }
            }
            await client.query('COMMIT');
            res.status(200).json(updateResult.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            if (error.message === '404') {
                return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
            }
            if (error.message === '403') {
                return res.status(403).json({ message: '이 게시글을 수정할 권한이 없습니다.' });
            }
            console.error('게시글 수정 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        } finally {
            client.release();
        }
    });

    router.delete('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const currentUserId = req.user.id;
        try {
            const postResult = await pool.query('SELECT "userId" FROM posts WHERE id = $1', [id]);
            if (postResult.rows.length === 0) {
                return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
            }
            if (postResult.rows[0].userId !== currentUserId) {
                return res.status(403).json({ message: '이 게시글을 삭제할 권한이 없습니다.' });
            }
            await pool.query('DELETE FROM posts WHERE id = $1', [id]);
            res.status(200).json({ message: '게시글이 성공적으로 삭제되었습니다.' });
        } catch (error) {
            console.error('게시글 삭제 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    router.post('/:id/like', authMiddleware, async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        if (isNaN(postId)) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID입니다.' });
        }
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const postResult = await client.query('SELECT "likeCount" FROM posts WHERE id = $1', [postId]);
            if (postResult.rows.length === 0) {
                throw new Error('게시글을 찾을 수 없습니다.');
            }
            let currentLikeCount = postResult.rows[0].likeCount || 0;
            const likeResult = await client.query('SELECT * FROM likes WHERE "userId" = $1 AND "postId" = $2', [userId, postId]);
            if (likeResult.rows.length > 0) {
                await client.query('DELETE FROM likes WHERE "userId" = $1 AND "postId" = $2', [userId, postId]);
                await client.query('UPDATE posts SET "likeCount" = $1 WHERE id = $2', [currentLikeCount - 1, postId]);
            } else {
                await client.query('INSERT INTO likes ("userId", "postId") VALUES ($1, $2)', [userId, postId]);
                await client.query('UPDATE posts SET "likeCount" = $1 WHERE id = $2', [currentLikeCount + 1, postId]);
            }
            await client.query('COMMIT');
            res.status(200).json({ message: '좋아요 상태가 변경되었습니다.' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('좋아요 API 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.', error: error.message });
        } finally {
            client.release();
        }
    });

    router.get('/:postId/likers', async (req, res) => {
        const { postId } = req.params;
        try {
            const result = await pool.query(
                `SELECT u.username FROM users u
                 JOIN likes l ON u.id = l."userId"
                 WHERE l."postId" = $1`,
                [postId]
            );
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('좋아요 누른 사용자 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
