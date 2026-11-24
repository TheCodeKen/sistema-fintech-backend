package com.fintech.msauditoria.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", ex.getStatusCode().value());
        body.put("message", ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("message", errors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler({java.time.format.DateTimeParseException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String,Object>> entrada(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of("status",400,"message","Entrada inválida; revise tipos, fechas y formato"));
    }
    @ExceptionHandler({org.springframework.dao.DataIntegrityViolationException.class,
            org.springframework.dao.ConcurrencyFailureException.class})
    public ResponseEntity<Map<String,Object>> conflicto(Exception ex) {
        return ResponseEntity.status(409).body(Map.of("status",409,"message","Conflicto de datos; consulte el estado y reintente la misma operación"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> inesperado(Exception ex) {
        org.slf4j.LoggerFactory.getLogger(getClass()).error("Error no controlado",ex);
        return ResponseEntity.status(500).body(Map.of("status",500,"message","Error interno del servidor"));
    }
}
