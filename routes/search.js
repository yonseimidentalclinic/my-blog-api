const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    router.get('/', async (req, res) => {
        const { term } = req.query;
        if (!term) {
            return res.status(200).json([]);
        }
        try {
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
