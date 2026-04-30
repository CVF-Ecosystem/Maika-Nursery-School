import jwt from 'jsonwebtoken'
import { findUserById } from './db.js'

const JWT_SECRET = process.env.MAIKA_JWT_SECRET || 'maika-dev-secret-change-me'
const TOKEN_TTL = process.env.MAIKA_TOKEN_TTL || '8h'

export function signToken(user) {
    return jwt.sign({
        sub: user.id,
        role: user.role,
        phone: user.phone,
        studentId: user.student_id,
    }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function publicUser(user) {
    return {
        id: user.id,
        role: user.role,
        name: user.display_name,
        phone: user.phone,
        email: user.email,
        studentId: user.student_id,
    }
}

export function requireAuth(req, res, next) {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Missing bearer token' })

    try {
        const payload = jwt.verify(token, JWT_SECRET)
        const user = findUserById(payload.sub)
        if (!user) return res.status(401).json({ error: 'Invalid token user' })
        req.user = user
        req.auth = payload
        next()
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' })
    }
}

export function requireRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' })
        next()
    }
}
