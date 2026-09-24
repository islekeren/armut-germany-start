process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
// Matches docker-compose.test.yml; the web suite uses armut_e2e_web.
process.env.DATABASE_URL ||=
  "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_api";
// Specs log in many users from one IP; the throttle spec re-enables limits
// locally. Jest already sets NODE_ENV=test, which the skip also requires.
process.env.THROTTLE_DISABLED ||= "true";

jest.setTimeout(60000);
