import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/database';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export interface LoginParams {
  email: string;
  password: string;
}

export const login = async (params: LoginParams) => {
  const user = await prisma.user.findUnique({
    where: { email: params.email }
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValidPassword = await bcrypt.compare(params.password, user.passwordHash);
  
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email,
    }
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};