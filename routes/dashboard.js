// routes/dashboard.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');
const adminMiddleware = require('../adminMiddleware');

module.exports = (pool) => {

    /**
     * GET /api/dashboard/stats
     * 관리자 대시보드에 필요한 주요 통계를 조회합니다. (관리자용)
     */
    router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            // 여러 통계 쿼리를 동시에 실행하여 효율성을 높입니다.
            const queries = [
                pool.query("SELECT COUNT(*) FROM users"),
                pool.query("SELECT COUNT(*) FROM posts"),
                pool.query("SELECT COUNT(*) FROM appointments"),
                pool.query("SELECT COUNT(*) FROM qna WHERE answer_body IS NULL") // 답변 대기 중인 문의
            ];

            const results = await Promise.all(queries);

            const stats = {
                totalUsers: parseInt(results[0].rows[0].count, 10),
                totalPosts: parseInt(results[1].rows[0].count, 10),
                totalAppointments: parseInt(results[2].rows[0].count, 10),
                pendingQna: parseInt(results[3].rows[0].count, 10)
            };

            res.status(200).json(stats);

        } catch (error) {
            console.error('대시보드 통계 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
