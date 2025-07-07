// routes/upload.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../authMiddleware');

// Multer 설정 (파일 저장 위치 및 파일명 규칙)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 'uploads' 라는 이름의 폴더에 이미지를 저장합니다.
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // 파일명 중복을 피하기 위해 현재 시간과 원본 파일명을 조합합니다.
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// 이미지 업로드 API (인증 필요)
// POST /api/upload
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }
    // 성공 시, 클라이언트가 접근할 수 있는 이미지 경로를 반환합니다.
    res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
});

module.exports = router;
