package com.fintech.msusuarios;

import com.fintech.msusuarios.service.NotificacionService;
import com.fintech.msusuarios.repository.*;
import com.fintech.msusuarios.dto.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.*;
import java.util.*;
import java.time.LocalDateTime;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class NotificacionServiceTest {
    @Mock NotificacionRepository repository;
    @Mock UsuarioRepository usuarios;
    @InjectMocks NotificacionService service;
    @BeforeEach void init(){login("CLIENTE");}
    void login(String role){var a=new UsernamePasswordAuthenticationToken("usuario",null,List.of(new SimpleGrantedAuthority("ROLE_"+role)));a.setDetails(2L);SecurityContextHolder.getContext().setAuthentication(a);}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void noPermiteContarSinSesion(){
        SecurityContextHolder.clearContext();assertEquals(401,assertThrows(ResponseStatusException.class,()->service.noLeidas()).getStatusCode().value());verifyNoInteractions(repository);
    }
    @Test void administradorSoloListaSuPropioBuzon(){
        login("ADMIN");when(repository.findByUsuarioId(eq(2L),any())).thenReturn(Page.empty());service.listar(false,0,10);
        verify(repository).findByUsuarioId(eq(2L),argThat(p->p.getPageSize()==10 && p.getSort().getOrderFor("id").isDescending()));
    }
    @Test void filtroYContadorUsanUsuarioAutenticado(){
        when(repository.findByUsuarioIdAndLeidaEnIsNull(eq(2L),any())).thenReturn(Page.empty());when(repository.countByUsuarioIdAndLeidaEnIsNull(2L)).thenReturn(4L);
        service.listar(true,0,10);assertEquals(4,service.noLeidas());verify(repository).findByUsuarioIdAndLeidaEnIsNull(eq(2L),any());
    }
    @Test void leerNotificacionAjenaNoExponeSiExiste(){
        assertEquals(404,assertThrows(ResponseStatusException.class,()->service.leer(99L)).getStatusCode().value());verify(repository).leer(eq(99L),eq(2L),any());
    }
    @Test void releerNotificacionPropiaEsIdempotente(){
        when(repository.existsByIdAndUsuarioId(99L,2L)).thenReturn(true);assertDoesNotThrow(()->service.leer(99L));
    }
    @Test void lecturaMasivaConservaLimiteDeLaPaginaConsultada(){service.leerTodas(100L);verify(repository).leerTodas(eq(2L),eq(100L),any());}
    @Test void noAceptaPaginasSinLimites(){
        for(int size:new int[]{0,51})assertThrows(ResponseStatusException.class,()->service.listar(false,0,size));
        assertThrows(ResponseStatusException.class,()->service.listar(false,-1,10));verifyNoInteractions(repository);
    }
    @Test void eventoValidoUsaClaveIdempotenteSinCambiarLectura(){
        when(usuarios.existsById(2L)).thenReturn(true);LocalDateTime date=LocalDateTime.of(2026,11,14,10,0);
        var e=new NotificacionEvento("tx:1:2",2L,NotificacionEvento.Tipo.MOVIMIENTO_CONFIRMADO,1L,"Pago confirmado","PEN 10.00",date);
        service.recibir(e);verify(repository).recibir("tx:1:2",2L,"MOVIMIENTO_CONFIRMADO",1L,"Pago confirmado","PEN 10.00",date);
    }
    @Test void eventoDeUsuarioEliminadoNoBloqueaLaCola(){
        service.recibir(new NotificacionEvento("tx:1:99",99L,NotificacionEvento.Tipo.MOVIMIENTO_CONFIRMADO,1L,"Confirmado","PEN 10",LocalDateTime.now()));verifyNoInteractions(repository);
    }
}
