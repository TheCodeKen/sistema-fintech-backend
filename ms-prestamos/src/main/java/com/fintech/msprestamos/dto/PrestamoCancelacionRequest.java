package com.fintech.msprestamos.dto;
import jakarta.validation.constraints.*;
public record PrestamoCancelacionRequest(@NotBlank @Size(min=5,max=500) String motivo) {}
