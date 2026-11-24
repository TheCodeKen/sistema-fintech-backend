package com.fintech.mscuentas;

import com.fintech.mscuentas.dto.CrearCuentaDTO;
import com.fintech.mscuentas.dto.CuentaResponse;
import com.fintech.mscuentas.client.AuditoriaFeignClient;
import com.fintech.mscuentas.client.UsuarioFeignClient;
import com.fintech.mscuentas.entity.Cuenta;
import com.fintech.mscuentas.repository.CuentaRepository;
import com.fintech.mscuentas.service.CuentaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CuentaServiceTest {
    @org.junit.jupiter.api.BeforeEach
    void autenticar() {
        var auth=new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("admin",null,
                java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN")));
        auth.setDetails(1L);
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
    }
    @org.junit.jupiter.api.AfterEach
    void limpiarSesion() { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }


    @Mock
    private CuentaRepository cuentaRepository;

    @Mock
    private AuditoriaFeignClient auditoriaFeignClient;

    @Mock
    private UsuarioFeignClient usuarioFeignClient;
    @Mock private com.fintech.mscuentas.service.AuditoriaOutbox auditoriaOutbox;

    @InjectMocks
    private CuentaService cuentaService;

    @Test
    void listarTodas_debeRetornarLista() {
        Cuenta c = Cuenta.builder()
                .id(1L).numeroCuenta("FT001").usuarioId(1L)
                .tipoCuenta(Cuenta.TipoCuenta.AHORROS).saldo(BigDecimal.ZERO)
                .moneda("PEN").estado(Cuenta.EstadoCuenta.ACTIVA).build();
        when(cuentaRepository.buscar(any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(c)));

        var result = cuentaService.listarTodas(null, null, null, PageRequest.of(0, 10));
        assertEquals(1, result.getTotalElements());
        assertEquals("FT001", result.getContent().get(0).getNumeroCuenta());
    }

    @Test
    void buscarPorIdInexistente_debeLanzarExcepcion() {
        when(cuentaRepository.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class, () -> cuentaService.buscarPorId(999L));
    }

    @Test
    void crear_debeRetornarCuentaCreada() {
        CrearCuentaDTO req = new CrearCuentaDTO();
        req.setUsuarioId(1L);
        req.setTipoCuenta("CORRIENTE");
        req.setSaldoInicial(new BigDecimal("1000.00"));
        req.setMoneda("PEN");

        Cuenta saved = Cuenta.builder()
                .id(1L).numeroCuenta("FT12345").usuarioId(1L)
                .tipoCuenta(Cuenta.TipoCuenta.CORRIENTE)
                .saldo(new BigDecimal("1000.00")).moneda("PEN")
                .estado(Cuenta.EstadoCuenta.ACTIVA).build();

        var usuario = new com.fintech.mscuentas.dto.UsuarioFeignResponse();
        usuario.setId(1L);
        usuario.setActivo(true);
        when(usuarioFeignClient.buscarPorId(1L)).thenReturn(usuario);
        when(cuentaRepository.save(any())).thenReturn(saved);

        CuentaResponse resp = cuentaService.crear(req);
        assertNotNull(resp);
        assertEquals("CORRIENTE", resp.getTipoCuenta());
    }

    @Test
    void repetirEstadoConfirmadoNoGuardaNiAuditaOtraVez() {
        Cuenta cuenta=Cuenta.builder().id(1L).usuarioId(1L).tipoCuenta(Cuenta.TipoCuenta.AHORROS).estado(Cuenta.EstadoCuenta.ACTIVA).saldo(BigDecimal.ZERO).build();
        when(cuentaRepository.bloquearPorId(1L)).thenReturn(Optional.of(cuenta));
        cuentaService.activar(1L);cuentaService.desbloquear(1L);
        cuenta.setEstado(Cuenta.EstadoCuenta.BLOQUEADA);cuentaService.bloquear(1L,"Motivo válido");
        cuenta.setEstado(Cuenta.EstadoCuenta.CONGELADA);cuentaService.congelar(1L,"Motivo válido");
        verify(cuentaRepository,never()).save(any());
        verifyNoInteractions(auditoriaOutbox);
    }

    @Test
    void motivoExcesivoSeRechazaAntesDeModificarLaCuenta() {
        var error=assertThrows(ResponseStatusException.class,()->cuentaService.bloquear(1L,"x".repeat(501)));
        assertEquals(400,error.getStatusCode().value());verifyNoInteractions(cuentaRepository);
    }
}
