package com.fintech.msusuarios.repository;

import com.fintech.msusuarios.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.rol = :rol order by u.id")
    java.util.List<Usuario> bloquearAdministradores(@Param("rol") Usuario.Rol rol);
    Optional<Usuario> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("""
        select u from Usuario u
        where (:rol is null or u.rol = :rol)
          and (:activo is null or u.activo = :activo)
          and (
              :busqueda is null
              or lower(coalesce(u.dni, '')) like lower(concat('%', :busqueda, '%'))
              or lower(u.nombre) like lower(concat('%', :busqueda, '%'))
              or lower(u.apellido) like lower(concat('%', :busqueda, '%'))
              or lower(concat(u.nombre, ' ', u.apellido)) like lower(concat('%', :busqueda, '%'))
              or lower(u.email) like lower(concat('%', :busqueda, '%'))
          )
        """)
    Page<Usuario> buscar(@Param("rol") Usuario.Rol rol,
                         @Param("activo") Boolean activo,
                         @Param("busqueda") String busqueda,
                         Pageable pageable);

    long countByRol(Usuario.Rol rol);
    long countByRolAndActivoTrue(Usuario.Rol rol);
    long countByActivoTrue();
    long countByActivoFalse();
    long countByFechaRegistroGreaterThanEqual(LocalDateTime fecha);
}
