import type { DB } from '../data/db';
import { initSchema } from '../data/db';
import { UserDAO } from '../data/dao/userDao';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface AuthServiceOptions {
  jwtSecret: string;
  tokenTTLSeconds?: number; // optional TTL, default 24h
}

export interface AuthTokenPayload {
  sub: number; // user id
  email: string;
}

export interface RegisterResult {
  id: number;
  email: string;
  created_at: string;
}

export class AuthService {
  private userDAO: UserDAO;
  private jwtSecret: string;
  private tokenTTLSeconds: number;

  constructor(private db: DB, options: AuthServiceOptions) {
    initSchema(db);
    this.userDAO = new UserDAO(db);
    this.jwtSecret = options.jwtSecret;
    this.tokenTTLSeconds = options.tokenTTLSeconds ?? 24 * 60 * 60;
  }

  async register(email: string, password: string): Promise<RegisterResult> {
    const existing = this.userDAO.findByEmail(email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const user = this.userDAO.create(email, hash);
    return { id: user.id, email: user.email, created_at: user.created_at };
  }

  async login(email: string, password: string): Promise<{ token: string }> {
    const user = this.userDAO.findByEmail(email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const payload: AuthTokenPayload = { sub: user.id, email: user.email };
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenTTLSeconds });
    return { token };
  }

  verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
  }
}