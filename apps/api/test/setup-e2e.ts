process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
// Matches docker-compose.test.yml; the web suite uses armut_e2e_web.
process.env.DATABASE_URL ||=
  "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_api";
// S3 mock from docker-compose.test.yml (adobe/s3mock needs path-style URLs).
process.env.S3_ENDPOINT ||= "http://127.0.0.1:9190";
process.env.S3_REGION ||= "us-east-1";
process.env.S3_BUCKET ||= "armut-e2e-uploads";
process.env.S3_ACCESS_KEY_ID ||= "e2e-access-key";
process.env.S3_SECRET_ACCESS_KEY ||= "e2e-secret-key";
process.env.S3_FORCE_PATH_STYLE ||= "true";
process.env.S3_PUBLIC_URL ||= "http://127.0.0.1:9190/armut-e2e-uploads";

// Specs log in many users from one IP; the throttle spec re-enables limits
// locally. Jest already sets NODE_ENV=test, which the skip also requires.
process.env.THROTTLE_DISABLED ||= "true";

jest.setTimeout(60000);
