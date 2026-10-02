ALTER TABLE `tenants`
    ADD COLUMN `currentRoomId` INTEGER NULL,
    ADD INDEX `tenants_currentRoomId_idx`(`currentRoomId`),
    ADD CONSTRAINT `tenants_currentRoomId_fkey`
        FOREIGN KEY (`currentRoomId`) REFERENCES `rooms`(`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
