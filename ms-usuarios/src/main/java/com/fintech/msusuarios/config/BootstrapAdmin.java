package com.fintech.msusuarios.config;
import com.fintech.msusuarios.entity.Usuario;
import com.fintech.msusuarios.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
@Component @Profile("!dev") @RequiredArgsConstructor
public class BootstrapAdmin implements CommandLineRunner {
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwords;
    @Value("${BOOTSTRAP_ADMIN_EMAIL:}") private String email;
    @Value("${BOOTSTRAP_ADMIN_PASSWORD:}") private String password;
    @Override public void run(String... args) {
        if(usuarios.countByRolAndActivoTrue(Usuario.Rol.ADMIN)>0) return;
        if(email.isBlank() || password.length()<12 || password.length()>72)
            throw new IllegalStateException("Configure BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD (12-72 caracteres) para el primer administrador");
        if(usuarios.existsByEmail(email)) throw new IllegalStateException("El correo de bootstrap ya existe; restaure el administrador existente");
        usuarios.save(Usuario.builder().email(email).password(passwords.encode(password)).nombre("Administrador")
            .apellido("Sistema").rol(Usuario.Rol.ADMIN).activo(true).build());
    }
}
