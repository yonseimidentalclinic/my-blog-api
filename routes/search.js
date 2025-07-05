// routes/search.js

const express = require('express');
const router = express.Router();

module.exports = (pool) => {

    // 게시글 검색 API (예: GET /api/search?term=검색어)
    router.get('/', async (req, res) => {
        const { term } = req.query; // URL의 쿼리 파라미터에서 검색어를 받습니다.

        if (!term) {
            // 검색어가 없으면 빈 배열을 반환합니다.
            return res.status(200).json([]);
        }

        try {
            // PostgreSQL의 ILIKE를 사용하여 대소문자를 구분하지 않고 제목을 검색합니다.
            // '%'는 어떤 문자든 일치하는 와일드카드입니다.
            const result = await pool.query(
                'SELECT * FROM posts WHERE title ILIKE $1 ORDER BY "createdAt" DESC',
                [`%${term}%`]
            );
            
            res.status(200).json(result.rows);

        } catch (error) {
            console.error('검색 API 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
