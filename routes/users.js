// routes/users.js

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

// JWT 시크릿 키는 .env 파일에서 관리하는 것이 가장 좋습니다.
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key-that-is-long-and-secure';

module.exports = (pool) => { // db 대신 pool을 받습니다.

    // 회원가입 API (경로: /api/users/register)
    router.post('/register', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }

        try {
            // 1. 사용자 이름 중복 확인
            const existingUserResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            if (existingUserResult.rows.length > 0) {
                return res.status(409).json({ message: '이미 존재하는 사용자 이름입니다.' });
            }

            // 2. 비밀번호 암호화 및 사용자 생성
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUserResult = await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
                [username, hashedPassword]
            );
            
            const newUser = newUserResult.rows[0];

            res.status(201).json({
                id: newUser.id,
                username: newUser.username,
                message: '회원가입이 성공적으로 완료되었습니다.'
            });

        } catch (error) {
            console.error('회원가입 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 로그인 API (경로: /api/users/login)
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }

        try {
            // 1. 사용자 정보 조회
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
            }

            // 2. 비밀번호 비교
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
            }

            // 3. JWT 생성
            const token = jwt.sign(
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(200).json({
                message: '로그인 성공!',
                token: token
            });

        } catch (error) {
            console.error('로그인 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // [추가] 특정 사용자가 작성한 모든 게시글 조회 API
    // 예: GET /api/users/3/posts
    router.get('/:userId/posts', async (req, res) => {
        const { userId } = req.params;
        try {
            // 요청된 ID의 사용자가 존재하는지 먼저 확인
            const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
            }
            
            // 해당 사용자의 모든 게시글을 최신순으로 조회
            const postsResult = await pool.query(
                'SELECT * FROM posts WHERE "userId" = $1 ORDER BY "createdAt" DESC',
                [userId]
            );
            
            // 사용자 이름과 게시글 목록을 함께 응답
            res.status(200).json({
                username: userResult.rows[0].username,
                posts: postsResult.rows
            });

        } catch (error) {
            console.error('사용자 게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
