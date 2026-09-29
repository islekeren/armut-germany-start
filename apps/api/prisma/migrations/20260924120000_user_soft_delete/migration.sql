-- Accounts are anonymised instead of hard-deleted (see UsersService.deleteAccount).
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
