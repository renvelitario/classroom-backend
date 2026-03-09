import type { Request, Response, NextFunction } from 'express';
import { ArcjetNodeRequest, slidingWindow } from '@arcjet/node';
import aj from '../config/arcjet';

type RateLimitRole = 'admin' | 'teacher' | 'student' | 'guest';

const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();

  let limit = 2;
  let message = 'Guest request limit exceeded (2 per min.).';

  try {
    const role: RateLimitRole = req.user?.role ?? 'guest';

    // Override default values based on role
    switch (role) {
      case 'admin':
        limit = 20;
        message = 'Admin request limit exceeded (20 per min.). Slow down.';
        break;
      case 'teacher':
        limit = 10;
        message = 'Teacher request limit exceeded (10 per min.). Please wait.';
        break;
      case 'student':
        limit = 5;
        message = 'Student request limit exceeded (5 per min.). Please sign up for higher limits';
        break;
    }

    const client = aj.withRule(
      slidingWindow({
        mode: 'LIVE',
        interval: 60,
        max: limit,
      })
    ) as any; // cast to any to allow .protect()

    const arcjetRequest: ArcjetNodeRequest = {
      headers: req.headers,
      method: req.method,
      url: req.originalUrl ?? req.url,
      socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? '0.0.0.0' },
    };

    const decision = await client.protect(arcjetRequest);

    if (decision.isDenied() && decision.reason.isBot()) {
      return res.status(403).json({ error: 'Forbidden', message });
    }

    if (decision.isDenied() && decision.reason.isShield()) {
      return res.status(403).json({ error: 'Forbidden', message: 'Request blocked by security shield' });
    }

    if (decision.isDenied() && decision.reason.isRateLimit()) {
      return res.status(429).json({ error: 'Too many requests', message });
    }

    next();
  } catch (e) {
    console.error('Arcjet middleware error:', e);

    // Use the role message as a fallback
    return res.status(500).json({ error: 'Internal server error', message });
  }
};

export default securityMiddleware;