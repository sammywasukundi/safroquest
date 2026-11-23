import { fileURLToPath } from 'node:url';
import { CHAIN } from '@safroquest/shared';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dbFile: process.env.DB_FILE ?? here('../data/db.json'),
  seedFile: here('../data/questions.seed.json'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()),
  /** In development the first account created becomes admin, so you can test the back-office. */
  devAdmin: process.env.DEV_ADMIN ? process.env.DEV_ADMIN === '1' : !isProd,
  adminAddresses: (process.env.ADMIN_ADDRESSES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  chainRest: process.env.CHAIN_REST ?? CHAIN.testnet.rest,
  sessionDays: 7,
  challengeMs: 5 * 60_000,
};
export type Config = typeof config;
