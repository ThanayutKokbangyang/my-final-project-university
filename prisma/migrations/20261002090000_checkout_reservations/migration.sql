-- Preserve reservations made by the old checkout implementation.
ALTER TABLE `Order` ADD COLUMN `stockReserved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cartSnapshot` JSON NULL;
UPDATE `Order` SET `stockReserved` = true WHERE `isPaid` = false;
ALTER TABLE `PromotionUsage` ADD COLUMN `orderId` INTEGER NULL;
CREATE UNIQUE INDEX `PromotionUsage_orderId_key` ON `PromotionUsage`(`orderId`);
ALTER TABLE `PromotionUsage` ADD CONSTRAINT `PromotionUsage_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- Product/inventory edits must not erase historical order items.
ALTER TABLE `OrderItem` DROP FOREIGN KEY `OrderItem_productId_fkey`;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OrderItem` DROP FOREIGN KEY `OrderItem_inventoryId_fkey`;
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_inventoryId_fkey`
    FOREIGN KEY (`inventoryId`) REFERENCES `Inventory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
