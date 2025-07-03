// routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();


const JWT_SECRET = process.env.JWT_SECRET;


module.exports = (pool) => {
    // 회원가입 API (경로: /register)
    router.post('/register', async (req, res) => {
        const { username, password } = req.body;

        // 1. 입력값 검증
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }

        try {
            // 2. 아이디 중복 확인
            const existingUser = await pool.get('SELECT * FROM users WHERE username = ?', [username]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ message: '이미 존재하는 사용자 이름입니다.' });
            }


            // 3. 비밀번호 암호화
            const hashedPassword = await bcrypt.hash(password, 10);

            // 4. 새로운 사용자 정보 저장
            const result = await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
                [username, hashedPassword]
            );

            // 5. 성공 응답
            res.status(201).json({
                ...result.rows[0],
                message: '회원가입이 성공적으로 완료되었습니다.'
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

     router.post('/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }

        try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            // 사용자 아이디로 DB에서 사용자 정보 조회
            const user = result.rows[0];
            if (!user) {
                return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
            }

            // 입력된 비밀번호와 DB의 암호화된 비밀번호 비교
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
            }

            // 비밀번호 일치 시, JWT 생성
            const token = jwt.sign(
                { id: user.id, username: user.username }, // 토큰에 담을 정보
                JWT_SECRET, // 시크릿 키
                { expiresIn: '1h' } // 유효 기간 (1시간)
            );

            // 생성된 토큰을 클라이언트에게 전달
            res.status(200).json({ message: '로그인 성공!', token: token });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });


    return router;
};