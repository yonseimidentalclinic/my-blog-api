// routes/qna.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');
const adminMiddleware = require('../adminMiddleware');

module.exports = (pool) => {

    /**
     * POST /api/qna
     * 환자가 새로운 문의 글을 작성합니다. (누구나 접근 가능)
     */
    router.post('/', async (req, res) => {
        const { patient_name, patient_contact, title, question_body, is_private } = req.body;

        if (!patient_name || !title || !question_body) {
            return res.status(400).json({ message: '성함, 제목, 문의 내용은 필수 항목입니다.' });
        }

        try {
            const newQuestion = await pool.query(
                `INSERT INTO qna (patient_name, patient_contact, title, question_body, is_private)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [patient_name, patient_contact, title, question_body, is_private]
            );
            res.status(201).json({ 
                message: '문의가 성공적으로 접수되었습니다.',
                qnaId: newQuestion.rows[0].id
            });
        } catch (error) {
            console.error('문의 생성 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    /**
     * GET /api/qna
     * 모든 문의/답변 목록을 조회합니다. (관리자용)
     */
    router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const allQna = await pool.query(
                'SELECT * FROM qna ORDER BY questioned_at DESC'
            );
            res.status(200).json(allQna.rows);
        } catch (error) {
            console.error('Q&A 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    /**
     * PUT /api/qna/:id/answer
     * 특정 문의 글에 답변을 작성하거나 수정합니다. (관리자용)
     */
    router.put('/:id/answer', authMiddleware, adminMiddleware, async (req, res) => {
        const { id } = req.params;
        const { answer_body } = req.body;

        if (!answer_body) {
            return res.status(400).json({ message: '답변 내용은 필수입니다.' });
        }

        try {
            const updatedQna = await pool.query(
                `UPDATE qna 
                 SET answer_body = $1, answered_at = CURRENT_TIMESTAMP 
                 WHERE id = $2 
                 RETURNING *`,
                [answer_body, id]
            );

            if (updatedQna.rows.length === 0) {
                return res.status(404).json({ message: '답변할 문의 글을 찾을 수 없습니다.' });
            }

            res.status(200).json({
                message: '답변이 성공적으로 등록되었습니다.',
                qna: updatedQna.rows[0]
            });
        } catch (error) {
            console.error('답변 등록 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
