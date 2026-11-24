package com.fintech.msusuarios.service;

import com.fintech.msusuarios.dto.*;
import com.fintech.msusuarios.entity.Usuario;
import com.fintech.msusuarios.repository.UsuarioRepository;
import com.fintech.msusuarios.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@RequiredArgsConstructor
@Slf4j
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditoriaService auditoriaService;

    // ── LOGIN ─────────────────────────────────────────────────────────────
    public LoginResponse login(LoginRequest request) {
        log.info("Intento de login para: {}", request.getEmail());

        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Credenciales inválidas"));

        if (!usuario.getActivo()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario inactivo");
        }

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }

        String token = jwtUtil.generateToken(usuario.getId(), usuario.getEmail(), usuario.getRol().name(), usuario.getTokenVersion());

        log.info("Login exitoso para: {}", request.getEmail());
        return LoginResponse.builder()
                .autenticado(true)
                .mensaje("Login exitoso")
                .usuarioId(usuario.getId())
                .nombre(usuario.getNombre())
                .apellido(usuario.getApellido())
                .email(usuario.getEmail())
                .rol(usuario.getRol().name())
                .token(token)
                .build();
    }

    // ── REGISTRO PÚBLICO (solo CLIENTE) ───────────────────────────────────
    public LoginResponse registrar(RegistroRequest request) {
        log.info("Nuevo registro para: {}", request.getEmail());

        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un usuario con email: " + request.getEmail());
        }

        Usuario usuario = Usuario.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .nombre(request.getNombre())
                .apellido(request.getApellido())
                .telefono(request.getTelefono())
                .rol(Usuario.Rol.CLIENTE)   // rol fijado — el cliente NO puede elegirlo
                .activo(true)
                .build();

        usuario = usuarioRepository.save(usuario);

        String token = jwtUtil.generateToken(usuario.getId(), usuario.getEmail(), usuario.getRol().name(), usuario.getTokenVersion());

        log.info("Registro exitoso para: {}", request.getEmail());
        return LoginResponse.builder()
                .autenticado(true)
                .mensaje("Registro exitoso")
                .usuarioId(usuario.getId())
                .nombre(usuario.getNombre())
                .apellido(usuario.getApellido())
                .email(usuario.getEmail())
                .rol(usuario.getRol().name())
                .token(token)
                .build();
    }

    // ── CRUD (solo ADMIN) ──────────────────────────────────────────────────

    public Page<UsuarioResponse> listarTodos(Usuario.Rol rol, Boolean activo, String busqueda, Pageable pageable) {
        String texto = busqueda == null || busqueda.isBlank() ? null : busqueda.trim();
        return usuarioRepository.buscar(rol, activo, texto, pageable).map(UsuarioResponse::from);
    }

    public UsuarioResponse buscarPorId(Long id) {
        com.fintech.msusuarios.config.security.Acceso.lectura(id);
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Usuario no encontrado con id: " + id));
        return UsuarioResponse.from(u);
    }

    /**
     * Crear usuario desde el panel ADMIN — el rol SÍ puede especificarse.
     * Este endpoint debe estar protegido para que solo ADMIN lo invoque.
     */
    @org.springframework.transaction.annotation.Transactional
    public UsuarioResponse crear(UsuarioRequest request) {
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El password es obligatorio al crear un usuario");
        }
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un usuario con email: " + request.getEmail());
        }

        Usuario usuario = Usuario.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .nombre(request.getNombre())
                .apellido(request.getApellido())
                .telefono(request.getTelefono())
                .dni(request.getDni())
                .rol(request.getRol())
                .activo(true)
                .build();

        UsuarioResponse response = UsuarioResponse.from(usuarioRepository.save(usuario));
        auditoriaService.registrar(auditoria("CREACION_USUARIO", "USUARIO", response.getId(),
                "Usuario creado con rol " + response.getRol()), null);
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public UsuarioResponse actualizar(Long id, UsuarioRequest request) {
        usuarioRepository.bloquearAdministradores(Usuario.Rol.ADMIN);
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Usuario no encontrado con id: " + id));

        Usuario.Rol rolAnterior = usuario.getRol();
        usuario.setNombre(request.getNombre());
        usuario.setApellido(request.getApellido());
        usuario.setTelefono(request.getTelefono());
        usuario.setDni(request.getDni());
        if (rolAnterior == Usuario.Rol.ADMIN && request.getRol() != Usuario.Rol.ADMIN) protegerUltimoAdministrador(usuario);
        usuario.setRol(request.getRol());
        usuario.setTokenVersion((usuario.getTokenVersion()==null ? 0 : usuario.getTokenVersion())+1);

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            usuario.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        UsuarioResponse response = UsuarioResponse.from(usuarioRepository.save(usuario));
        if (!rolAnterior.name().equals(response.getRol())) {
            auditoriaService.registrar(auditoria("CAMBIO_ROL_USUARIO", "USUARIO", id,
                    "Rol anterior: " + rolAnterior + "; nuevo: " + response.getRol()), null);
        }
        return response;
    }

    @org.springframework.transaction.annotation.Transactional
    public void eliminar(Long id) {
        usuarioRepository.bloquearAdministradores(Usuario.Rol.ADMIN);
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Usuario no encontrado con id: " + id));
        protegerUltimoAdministrador(usuario);
        cambiarEstado(id, false); // Baja lógica para conservar referencias e historial.
    }

    @org.springframework.transaction.annotation.Transactional
    public UsuarioResponse cambiarEstado(Long id, boolean activo) {
        usuarioRepository.bloquearAdministradores(Usuario.Rol.ADMIN);
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Usuario no encontrado con id: " + id));
        if (!activo) {
            protegerUltimoAdministrador(usuario);
        }
        boolean estadoAnterior = usuario.getActivo();
        usuario.setActivo(activo);
        usuario.setTokenVersion((usuario.getTokenVersion()==null ? 0 : usuario.getTokenVersion())+1);
        UsuarioResponse response = UsuarioResponse.from(usuarioRepository.save(usuario));
        auditoriaService.registrar(auditoria(activo ? "ACTIVACION_USUARIO" : "DESACTIVACION_USUARIO",
                "USUARIO", id, "Estado anterior: " + estadoAnterior + "; nuevo: " + activo), null);
        return response;
    }

    private void protegerUltimoAdministrador(Usuario usuario) {
        if (usuario.getRol() == Usuario.Rol.ADMIN
                && usuarioRepository.countByRolAndActivoTrue(Usuario.Rol.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede desactivar o eliminar al último administrador");
        }
    }

    private AuditoriaRequest auditoria(String accion, String entidad, Long id, String detalles) {
        AuditoriaRequest request = new AuditoriaRequest();
        request.setAccion(accion);
        request.setEntidadAfectada(entidad);
        request.setEntidadId(id);
        request.setDetalles(detalles);
        return request;

    }
}
