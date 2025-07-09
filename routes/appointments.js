// routes/appointments.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware'); // 관리자 인증을 위해 사용
const adminMiddleware = require('../adminMiddleware'); // [추가] 관리자 확인 미들웨어

module.exports = (pool) => {

    /**
     * POST /api/appointments
     * 새 예약을 생성합니다. (환자용, 누구나 접근 가능)
     */
    router.post('/', async (req, res) => {
        const { patient_name, patient_contact, appointment_date, appointment_time, notes } = req.body;

        // 필수 정보가 누락되었는지 확인합니다.
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

            // 성공적으로 예약이 접수되었음을 클라이언트에 알립니다.
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
     * 모든 예약 목록 조회 (관리자용, 인증 + 관리자 권한 필요)
     */
    // [수정] authMiddleware 다음에 adminMiddleware를 추가하여 이중으로 확인합니다.

    router.get('/', authMiddleware,adminMiddleware, async (req, res) => {
        try {
            const allAppointments = await pool.query(
                'SELECT * FROM appointments ORDER BY appointment_date DESC, appointment_time DESC'
            );
            res.status(200).json(allAppointments.rows);
        } catch (error) {
            console.error('예약 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
