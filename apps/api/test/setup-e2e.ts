process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.DATABASE_URL ||=
  "postgresql://postgres:postgres@127.0.0.1:5432/armut_test";

jest.setTimeout(60000);
