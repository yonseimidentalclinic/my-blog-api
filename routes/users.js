// routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (pool) => {
    // 회원가입 API
    router.post('/register', async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호는 필수입니다.' });
        }
        try {
            const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ message: '이미 존재하는 사용자 이름입니다.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
                [username, hashedPassword]
            );
            res.status(201).json({
                ...result.rows[0],
                message: '회원가입이 성공적으로 완료되었습니다.'
            });
        } catch (error) {
            console.error('Register Error:', error);
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
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            res.status(200).json({ message: '로그인 성공!', token: token });
        } catch (error) {
            console.error('Login Error:', error);
            res.status(500).json({ message: '서버 에러가 발생했습니다.' });
        }
    });

    return router;
};
