import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone:true,
  imports:[CommonModule,FormsModule,MatDialogModule,MatButtonModule,MatFormFieldModule,MatInputModule],
  template:`
    <h2 mat-dialog-title>{{data.titulo}}</h2>
    <mat-dialog-content class="form">
      <p class="form-intro">{{data.texto}}</p>
      <mat-form-field appearance="outline" *ngIf="data.motivo"><mat-label>Motivo de la decisión</mat-label><textarea matInput [(ngModel)]="motivo" rows="3" maxlength="500" required></textarea><mat-hint>Obligatorio. Hasta 500 caracteres.</mat-hint></mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button (click)="ref.close(false)">Cancelar</button><button mat-raised-button color="primary" [disabled]="data.motivo && !motivo.trim()" (click)="ref.close(data.motivo ? motivo.trim() : true)">Confirmar</button></mat-dialog-actions>
  `
})
export class ConfirmationDialogComponent {
  data=inject<{titulo:string;texto:string;motivo:boolean}>(MAT_DIALOG_DATA);
  ref=inject(MatDialogRef<ConfirmationDialogComponent>);
  motivo='';
}

export async function solicitarConfirmacion(dialog:MatDialog,titulo:string,texto:string,motivo=false):Promise<boolean|string> {
  return await firstValueFrom(dialog.open(ConfirmationDialogComponent,{width:'460px',maxWidth:'94vw',data:{titulo,texto,motivo},autoFocus:false}).afterClosed()) || false;
}
