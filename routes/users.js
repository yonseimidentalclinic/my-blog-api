// routes/users.js (비밀 관리자 지정 API)
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key-that-is-long-and-secure';

module.exports = (pool) => {

    // [추가] 특정 사용자를 관리자로 만드는 비밀 API (임시로 사용 후 반드시 삭제해야 합니다!)
    router.get('/make-admin-secret-route/:username', async (req, res) => {
        const { username } = req.params;
        try {
            const result = await pool.query(
                "UPDATE users SET role = 'admin' WHERE username = $1 RETURNING *",
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(404).send('해당 사용자를 찾을 수 없습니다.');
            }

            res.status(200).send(`${result.rows[0].username} 님이 성공적으로 관리자가 되었습니다.`);

        } catch (error) {
            console.error('관리자 지정 에러:', error);
            res.status(500).send('서버 에러가 발생했습니다.');
        }
    });


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

    return router;
};
