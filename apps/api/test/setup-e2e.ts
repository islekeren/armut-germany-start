process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
// Matches docker-compose.test.yml; the web suite uses armut_e2e_web.
process.env.DATABASE_URL ||=
  "postgresql://postgres:postgres@127.0.0.1:5433/armut_e2e_api";

jest.setTimeout(60000);
