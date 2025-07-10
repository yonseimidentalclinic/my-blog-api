// routes/appointments.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');
const adminMiddleware = require('../adminMiddleware');

module.exports = (pool) => {

    /**
     * POST /api/appointments
     * 새 예약을 생성합니다. (환자용, 누구나 접근 가능)
     */
    router.post('/', async (req, res) => {
        const { patient_name, patient_contact, appointment_date, appointment_time, notes } = req.body;

        if (!patient_name || !patient_contact || !appointment_date || !appointment_time) {
            return res.status(400).json({ message: '이름, 연락처, 예약 날짜와 시간은 필수 항목입니다.' });
        }

        try {
            const newAppointment = await pool.query(
                `INSERT INTO appointments (patient_name, patient_contact, appointment_date, appointment_time, notes)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [patient_name, patient_contact, appointment_date, appointment_time, notes]
            );

            res.status(201).json({ 
                message: '예약이 성공적으로 접수되었습니다.',
                appointment: newAppointment.rows[0]
            });
        } catch (error) {
            console.error('예약 생성 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    /**
     * GET /api/appointments
     * 모든 예약 목록을 조회합니다. (관리자용, 페이지네이션 적용)
     */
    router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
        // [수정] URL 쿼리에서 page와 limit 값을 가져옵니다. (기본값: 1페이지, 10개씩)
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;

        try {
            // [수정] 두 개의 쿼리를 동시에 실행합니다.
            const appointmentsPromise = pool.query(
                'SELECT * FROM appointments ORDER BY appointment_date DESC, appointment_time DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            const totalPromise = pool.query('SELECT COUNT(*) FROM appointments');

            const [appointmentsResult, totalResult] = await Promise.all([appointmentsPromise, totalPromise]);
            
            const totalAppointments = parseInt(totalResult.rows[0].count, 10);
            const totalPages = Math.ceil(totalAppointments / limit);

            // [수정] 응답 형식에 페이지 정보를 추가합니다.
            res.status(200).json({
                appointments: appointmentsResult.rows,
                totalPages: totalPages,
                currentPage: page,
            });

        } catch (error) {
            console.error('예약 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
