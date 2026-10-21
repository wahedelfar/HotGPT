ALTER TABLE `users`
  ADD COLUMN `freeAnswersUsed` int NOT NULL DEFAULT 0,
  ADD COLUMN `tokenBalance` int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `payment_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `paymentMethod` enum('vodafone_cash','paypal') NOT NULL,
  `packageTokens` int NOT NULL,
  `amountEgp` int NOT NULL,
  `transferReference` varchar(200) NULL,
  `screenshotData` longtext NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewedAt` timestamp NULL,
  `reviewedBy` varchar(320) NULL,
  PRIMARY KEY (`id`),
  KEY `payment_requests_userId_idx` (`userId`),
  KEY `payment_requests_status_idx` (`status`)
);
