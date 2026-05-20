import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { usersRepo } from '../repositories/users.repo.js';
import { UnauthorizedError } from '../utils/errors.js';

export async function login({ email, password }) {
  const user = await usersRepo.findByEmail(email);
  if (!user || !user.activo) throw new UnauthorizedError('Credenciales inválidas');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new UnauthorizedError('Credenciales inválidas');

  await usersRepo.markLogin(user.id);

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, nombre: user.nombre },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  return {
    token,
    user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role }
  };
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
