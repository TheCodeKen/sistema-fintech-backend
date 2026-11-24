import { Component, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AsistentePanelComponent } from './asistente-panel.component';

@Component({
  selector:'app-asistente',standalone:true,imports:[MatDialogModule,MatIconModule],
  template:`<button type="button" class="assistant-launcher" aria-label="Abrir asistente de IA" aria-haspopup="dialog" (click)="abrir()"><mat-icon aria-hidden="true">chat_bubble_outline</mat-icon><span>Asistente IA</span></button>`,
  styles:[`.assistant-launcher{position:fixed;right:26px;bottom:22px;z-index:950;display:flex;align-items:center;gap:9px;background:#004481;color:white;border:1px solid #1464a5;border-radius:8px;padding:12px 17px;font:inherit;font-size:12px;box-shadow:0 4px 16px #07214618;cursor:pointer}.assistant-launcher mat-icon{font-size:20px;width:20px;height:20px}.assistant-launcher:focus-visible{outline:2px solid #2dcccd;outline-offset:4px}@media(max-width:600px){.assistant-launcher{right:18px;bottom:16px;padding:11px 13px}}`]
})
export class AsistenteComponent implements OnDestroy {
  private ref:MatDialogRef<AsistentePanelComponent>|null=null;
  constructor(private dialog:MatDialog){}
  abrir():void{
    if(this.ref)return;
    this.ref=this.dialog.open(AsistentePanelComponent,{width:'460px',maxWidth:'100vw',height:'100dvh',maxHeight:'100dvh',position:{right:'0',top:'0'},panelClass:'assistant-dialog',ariaLabel:'Asistente de IA de FinTechPro',restoreFocus:true});
    this.ref.afterClosed().subscribe(()=>this.ref=null);
  }
  ngOnDestroy():void{this.ref?.close();}
}
