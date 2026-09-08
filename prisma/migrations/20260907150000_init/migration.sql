-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProxyPoolType" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "BrowserProfileType" AS ENUM ('STATIC', 'DISPOSABLE');

-- CreateEnum
CREATE TYPE "ApiProfileMode" AS ENUM ('DISPOSABLE', 'STATIC', 'AUTO');

-- CreateEnum
CREATE TYPE "ApiRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProxyOutcome" AS ENUM ('SUCCESS', 'ERROR', 'RATE_LIMITED');

-- CreateTable
CREATE TABLE "Api" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scriptName" TEXT NOT NULL,
    "targetDomain" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 1,
    "maxQueuedRequests" INTEGER NOT NULL DEFAULT 100,
    "profileMode" "ApiProfileMode" NOT NULL DEFAULT 'DISPOSABLE',
    "disposableProfileMaxRequests" INTEGER NOT NULL DEFAULT 1,
    "disposableProfileRetentionMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Api_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProxyPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProxyPoolType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxyPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proxy" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "protocol" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiProxyPool" (
    "apiId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requestsPerHour" INTEGER NOT NULL DEFAULT 60,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxConsecutiveFailures" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "ApiProxyPool_pkey" PRIMARY KEY ("apiId","poolId")
);

-- CreateTable
CREATE TABLE "ProxyUsage" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "targetDomain" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "totalRequestCount" INTEGER NOT NULL DEFAULT 0,
    "totalFailureCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "cooldownUntil" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastOutcome" "ProxyOutcome",
    "lastError" TEXT,
    "lastStatusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProxyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileDir" TEXT NOT NULL,
    "type" "BrowserProfileType" NOT NULL,
    "apiId" TEXT,
    "proxyId" TEXT,
    "browserEngine" TEXT NOT NULL DEFAULT 'chromium',
    "userAgent" TEXT,
    "viewportWidth" INTEGER NOT NULL DEFAULT 1440,
    "viewportHeight" INTEGER NOT NULL DEFAULT 900,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "timezoneId" TEXT NOT NULL DEFAULT 'America/Chicago',
    "fingerprintPresetId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "maxRequests" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiProfileLink" (
    "apiId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "ApiProfileLink_pkey" PRIMARY KEY ("apiId","profileId")
);

-- CreateTable
CREATE TABLE "ApiRun" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "proxyId" TEXT,
    "profileId" TEXT,
    "status" "ApiRunStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "traffic" JSONB,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Api_slug_key" ON "Api"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProxyPool_name_key" ON "ProxyPool"("name");

-- CreateIndex
CREATE INDEX "Proxy_poolId_enabled_idx" ON "Proxy"("poolId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_poolId_value_key" ON "Proxy"("poolId", "value");

-- CreateIndex
CREATE INDEX "ApiProxyPool_poolId_enabled_idx" ON "ApiProxyPool"("poolId", "enabled");

-- CreateIndex
CREATE INDEX "ProxyUsage_apiId_targetDomain_cooldownUntil_idx" ON "ProxyUsage"("apiId", "targetDomain", "cooldownUntil");

-- CreateIndex
CREATE INDEX "ProxyUsage_proxyId_lastUsedAt_idx" ON "ProxyUsage"("proxyId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProxyUsage_apiId_proxyId_targetDomain_key" ON "ProxyUsage"("apiId", "proxyId", "targetDomain");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserProfile_name_key" ON "BrowserProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserProfile_profileDir_key" ON "BrowserProfile"("profileDir");

-- CreateIndex
CREATE INDEX "BrowserProfile_type_enabled_locked_idx" ON "BrowserProfile"("type", "enabled", "locked");

-- CreateIndex
CREATE INDEX "BrowserProfile_apiId_type_expiresAt_idx" ON "BrowserProfile"("apiId", "type", "expiresAt");

-- CreateIndex
CREATE INDEX "ApiRun_apiId_queuedAt_idx" ON "ApiRun"("apiId", "queuedAt");

-- CreateIndex
CREATE INDEX "ApiRun_status_queuedAt_idx" ON "ApiRun"("status", "queuedAt");

-- AddForeignKey
ALTER TABLE "Proxy" ADD CONSTRAINT "Proxy_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "ProxyPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiProxyPool" ADD CONSTRAINT "ApiProxyPool_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "Api"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiProxyPool" ADD CONSTRAINT "ApiProxyPool_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "ProxyPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyUsage" ADD CONSTRAINT "ProxyUsage_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "Api"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyUsage" ADD CONSTRAINT "ProxyUsage_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "Api"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserProfile" ADD CONSTRAINT "BrowserProfile_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiProfileLink" ADD CONSTRAINT "ApiProfileLink_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "Api"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiProfileLink" ADD CONSTRAINT "ApiProfileLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BrowserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRun" ADD CONSTRAINT "ApiRun_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "Api"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRun" ADD CONSTRAINT "ApiRun_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRun" ADD CONSTRAINT "ApiRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BrowserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

