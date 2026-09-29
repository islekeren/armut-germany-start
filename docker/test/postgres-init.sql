-- One database per e2e suite so the API suite's resets never wipe the
-- data Playwright seeded (and vice versa).
CREATE DATABASE armut_e2e_api;
CREATE DATABASE armut_e2e_web;
