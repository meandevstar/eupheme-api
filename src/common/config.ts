const config: { [key: string]: any } = {
  dbUrl: process.env.DB_URL,
  logDbUrl: process.env.LOG_DB_URL,
  port: process.env.PORT,

  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,

  socketPort: process.env.SOCKET_PORT,

  jwtAlgorithm: process.env.JWT_ALGORITHM,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,

  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION,
  s3PublicBucket: process.env.S3_BUCKET,
  s3PrivateBucket: process.env.S3_PRIVATE_BUCKET,

  mediaHost: process.env.MEDIA_HOST,
};

export default config;
