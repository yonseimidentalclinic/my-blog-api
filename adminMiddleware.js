// adminMiddleware.js

/**
 * 사용자의 역할(role)이 'admin'인지 확인하는 미들웨어입니다.
 * 이 미들웨어는 반드시 authMiddleware 다음에 실행되어야 합니다.
 */
function adminMiddleware(req, res, next) {
    // authMiddleware가 생성한 req.user 객체와 그 안의 role을 확인합니다.
    if (req.user && req.user.role === 'admin') {
        // 사용자의 역할이 'admin'이면, 다음 단계로 진행합니다.
        next(); 
    } else {
        // 'admin'이 아니면, 접근 거부(403 Forbidden) 응답을 보냅니다.
        res.status(403).json({ message: '접근 권한이 없습니다. 관리자만 접근할 수 있습니다.' });
    }
}

module.exports = adminMiddleware;
