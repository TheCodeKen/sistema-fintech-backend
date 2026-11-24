SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='auditoria' AND column_name='evento_id')=0, 'ALTER TABLE `auditoria` ADD COLUMN `evento_id` varchar(64) UNIQUE', 'SELECT 1');
PREPARE migration_stmt FROM @ddl;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='usuarios' AND column_name='token_version')=0, 'ALTER TABLE `usuarios` ADD COLUMN `token_version` int', 'SELECT 1');
PREPARE migration_stmt FROM @ddl;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
