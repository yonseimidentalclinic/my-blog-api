// routes/users.js (비밀 관리자 지정 API)
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const authMiddleware = require('../authMiddleware'); // 인증 미들웨어 추가
const adminMiddleware = require('../adminMiddleware'); // 관리자 확인 미들웨어


const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key-that-is-long-and-secure';

module.exports = (pool) => {

    

    // --- 기존 코드들 ---
    
    // 회원가입 API
    router.post('/register', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }
        try {
            const existingUserResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            if (existingUserResult.rows.length > 0) {
                return res.status(409).json({ message: '이미 존재하는 사용자 이름입니다.' });
            }
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

    // 로그인 API
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }
        try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            const user = result.rows[0];
            if (!user) {
                return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: '아이디 또는 비밀번호가 잘못되었습니다.' });
            }
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            res.status(200).json({
                message: '로그인 성공!',
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role 
                }
            });
        } catch (error) {
            console.error('로그인 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // 특정 사용자 게시글 조회 API
    router.get('/:userId/posts', async (req, res) => {
        const { userId } = req.params;
        try {
            const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
            }
            const postsResult = await pool.query(
                'SELECT * FROM posts WHERE "userId" = $1 ORDER BY "createdAt" DESC',
                [userId]
            );
            res.status(200).json({
                username: userResult.rows[0].username,
                posts: postsResult.rows
            });
        } catch (error) {
            console.error('사용자 게시글 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    // [추가] 비밀번호 변경 API
    router.put('/change-password', authMiddleware, async (req, res) => {
        const { id: userId } = req.user; // 토큰에서 사용자 ID를 가져옵니다.
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력해야 합니다.' });
        }

        try {
            // 1. 데이터베이스에서 현재 사용자의 정보를 가져옵니다.
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            const user = userResult.rows[0];

            if (!user) {
                return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다.' });
            }

            // 2. 입력된 현재 비밀번호가 맞는지 확인합니다.
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
            }

            // 3. 새 비밀번호를 암호화합니다.
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // 4. 데이터베이스에 새 비밀번호를 업데이트합니다.
            await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

            res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });

        } catch (error) {
            console.error('비밀번호 변경 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

     // --- [추가] 관리자 전용 API ---

    /**
     * GET /api/users
     * 모든 사용자 목록을 조회합니다. (관리자용)
     */
    router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            // 비밀번호를 제외한 사용자 정보를 가져옵니다.
            const result = await pool.query('SELECT id, username, role FROM users ORDER BY id ASC');
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('사용자 목록 조회 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    /**
     * PUT /api/users/:userId/reset-password
     * 특정 사용자의 비밀번호를 초기화합니다. (관리자용)
     */
    router.put('/:userId/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
        const { userId } = req.params;
        const defaultPassword = '123456'; // 임시 비밀번호

        try {
            const hashedDefaultPassword = await bcrypt.hash(defaultPassword, 10);
            const result = await pool.query(
                'UPDATE users SET password = $1 WHERE id = $2 RETURNING username',
                [hashedDefaultPassword, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: '해당 사용자를 찾을 수 없습니다.' });
            }

            res.status(200).json({ message: `${result.rows[0].username} 님의 비밀번호가 성공적으로 초기화되었습니다.` });

        } catch (error) {
            console.error('비밀번호 초기화 에러:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });



    return router;
};
