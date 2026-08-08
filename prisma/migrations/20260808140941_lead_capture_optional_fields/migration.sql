-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "company" DROP NOT NULL;
ALTER TABLE "leads" ADD COLUMN "website" TEXT;
ALTER TABLE "leads" ADD COLUMN "marketingConsentAt" TIMESTAMP(3);
