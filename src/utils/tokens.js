const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('./ApiError');

function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId), typ: 'access' }, env.jwtSecret, {
    expiresIn: env.jwtAccessExpire,
  });
}

function signRefreshToken(userId) {
  return jwt.sign(
    { sub: String(userId), typ: 'refresh', jti: crypto.randomUUID() },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpire }
  );
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.typ !== 'access') {
      throw new ApiError(401, 'Invalid access token');
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired access token');
  }
}

function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtRefreshSecret);
    if (payload.typ !== 'refresh') {
      throw new ApiError(401, 'Invalid refresh token');
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueTokenPair(userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  return { accessToken, refreshToken };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  issueTokenPair,
};
