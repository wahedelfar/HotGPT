CREATE TABLE IF NOT EXISTS `admin_credentials` (
  `email` varchar(320) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`)
);
