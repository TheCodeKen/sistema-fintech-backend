CREATE DATABASE IF NOT EXISTS fintech_usuarios;
CREATE DATABASE IF NOT EXISTS fintech_cuentas;
CREATE DATABASE IF NOT EXISTS fintech_transacciones;
CREATE DATABASE IF NOT EXISTS fintech_prestamos;
CREATE DATABASE IF NOT EXISTS fintech_auditoria;

GRANT ALL PRIVILEGES ON fintech_usuarios.* TO 'fintech_user'@'%';
GRANT ALL PRIVILEGES ON fintech_cuentas.* TO 'fintech_user'@'%';
GRANT ALL PRIVILEGES ON fintech_transacciones.* TO 'fintech_user'@'%';
GRANT ALL PRIVILEGES ON fintech_prestamos.* TO 'fintech_user'@'%';
GRANT ALL PRIVILEGES ON fintech_auditoria.* TO 'fintech_user'@'%';
FLUSH PRIVILEGES;
