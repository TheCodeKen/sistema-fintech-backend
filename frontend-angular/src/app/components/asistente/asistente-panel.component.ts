import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AsistenteService, ModoAsistente, RespuestaAsistente, SolicitudAsistente, TurnoAsistente } from '../../services/asistente.service';

interface Mensaje {rol:'USER'|'ASSISTANT';texto:string;fuentes?:RespuestaAsistente['fuentes'];datosConsultados?:boolean;}

@Component({
  standalone:true,
  imports:[CommonModule,FormsModule,RouterLink,MatDialogModule,MatIconModule],
  template:`
    <div class="assistant-panel">
      <header><div><span class="assistant-eyebrow">FinTechPro · IA</span><h2>{{modo==='ADMIN' ? 'Asistente administrativo' : 'Tu asistente'}}</h2><p>Consulta, comprende y revisa.</p></div><button type="button" class="icon-button" aria-label="Cerrar asistente" (click)="ref.close()"><mat-icon>close</mat-icon></button></header>
      <section class="assistant-options" aria-label="Opciones del asistente">
        <div class="mode-switch" *ngIf="isAdmin"><button type="button" [attr.aria-pressed]="modo==='ADMIN'" [disabled]="enviando" (click)="cambiarModo('ADMIN')">Administración</button><button type="button" [attr.aria-pressed]="modo==='CLIENTE'" [disabled]="enviando" (click)="cambiarModo('CLIENTE')">Mis consultas</button></div>
        <label class="data-option"><input type="checkbox" [(ngModel)]="consultarDatos" [disabled]="enviando || !disponible" (ngModelChange)="cambiarPermiso()"><span>{{modo==='ADMIN' ? 'Consultar información operativa autorizada' : 'Consultar mis datos autorizados'}}</span></label>
        <p>{{procesamientoLocal ? 'Si lo activas, el modelo local consultará los datos necesarios, con cuentas enmascaradas. No se envían a un proveedor externo.' : 'Si lo activas, se enviarán al proveedor de IA los datos necesarios, con cuentas enmascaradas.'}} El asistente no realiza operaciones.</p>
      </section>
      <div class="assistant-conversation" #conversation role="log" aria-label="Conversación con el asistente" aria-live="polite" [attr.aria-busy]="enviando">
        <p class="assistant-status" role="status" *ngIf="cargando">Comprobando disponibilidad…</p>
        <div class="assistant-unavailable" *ngIf="!cargando && !disponible"><h3>El asistente aún no está disponible</h3><p>{{estadoError || 'Está pendiente de activación por el administrador del sistema.'}}</p><button class="text-button" type="button" (click)="comprobar()">Reintentar conexión</button></div>
        <section class="assistant-welcome" *ngIf="disponible && !mensajes.length"><mat-icon aria-hidden="true">chat_bubble_outline</mat-icon><h3>¿En qué puedo ayudarte?</h3><p>{{consultarDatos ? 'Puedo explicar información que tu sesión permite consultar.' : 'Puedo orientarte con los formularios. Activa la consulta de datos si necesitas revisar tus registros.'}}</p><div class="suggestions"><button type="button" *ngFor="let sugerencia of sugerencias" (click)="preguntar(sugerencia)">{{sugerencia}}</button></div></section>
        <article class="assistant-message" *ngFor="let mensaje of mensajes" [class.user-message]="mensaje.rol==='USER'"><span class="message-author">{{mensaje.rol==='USER' ? 'Tú' : 'Asistente IA'}}</span><span class="answer-scope" *ngIf="mensaje.rol==='ASSISTANT'">{{mensaje.datosConsultados ? 'Con datos autorizados' : 'Orientación general'}}</span><p>{{mensaje.texto}}</p><nav *ngIf="mensaje.fuentes?.length" aria-label="Información consultada"><span>Información consultada</span><a *ngFor="let fuente of mensaje.fuentes" [routerLink]="fuente.enlace" (click)="ref.close()">{{fuente.titulo}} <span aria-hidden="true">↗</span></a></nav></article>
        <p class="assistant-status" role="status" *ngIf="enviando">Consultando…</p>
      </div>
      <div class="assistant-error" role="alert" *ngIf="error">{{error}}</div>
      <form class="assistant-compose" (ngSubmit)="enviar()"><label class="sr-label" for="assistant-question">Tu pregunta</label><textarea id="assistant-question" name="pregunta" [(ngModel)]="pregunta" maxlength="1200" rows="3" [disabled]="enviando || !disponible" placeholder="Escribe tu consulta…" (keydown.control.enter)="enviar();$event.preventDefault()" aria-describedby="assistant-privacy"></textarea><div class="compose-actions"><button type="button" class="text-button" [disabled]="enviando || !mensajes.length" (click)="limpiar()">Nueva conversación</button><button type="submit" class="send-button" [disabled]="enviando || !disponible || !pregunta.trim() || pregunta.length>1200">{{enviando ? 'Consultando…' : 'Enviar'}} <mat-icon aria-hidden="true">arrow_upward</mat-icon></button></div><p id="assistant-privacy">{{procesamientoLocal ? 'Ollama local: tus mensajes se procesan en este equipo, sin cargos por API.' : 'Tus mensajes se envían al proveedor de IA configurado.'}} No incluyas claves. Revisa la respuesta en el detalle antes de decidir.</p></form>
    </div>
  `,
  styleUrl:'./asistente-panel.component.css'
})
export class AsistentePanelComponent implements OnInit,OnDestroy {
  modo:ModoAsistente;consultarDatos=false;disponible=false;cargando=true;estadoError='';enviando=false;error='';pregunta='';mensajes:Mensaje[]=[];
  procesamientoLocal=false;
  readonly isAdmin:boolean;private readonly usuarioId:number|undefined;private subscriptions=new Subscription();private estadoSubscription?:Subscription;
  @ViewChild('conversation') conversation?:ElementRef<HTMLElement>;
  constructor(private api:AsistenteService,private auth:AuthService,private router:Router,public ref:MatDialogRef<AsistentePanelComponent>){
    const sesion=auth.getSession();this.isAdmin=sesion?.rol==='ADMIN';this.modo=this.isAdmin?'ADMIN':'CLIENTE';this.usuarioId=sesion?.usuarioId;
  }
  ngOnInit():void{this.comprobar();}
  ngOnDestroy():void{this.estadoSubscription?.unsubscribe();this.subscriptions.unsubscribe();this.mensajes=[];}
  comprobar():void{
    this.estadoSubscription?.unsubscribe();this.cargando=true;this.estadoError='';
    this.estadoSubscription=this.api.estado().subscribe({next:e=>{this.disponible=e.disponible;this.procesamientoLocal=!!e.procesamientoLocal;this.cargando=false;this.estadoError=!e.disponible && this.procesamientoLocal ? 'Comprueba que Ollama esté iniciado y que el modelo local esté descargado.' : '';},error:()=>{this.cargando=false;this.disponible=false;this.estadoError='No pudimos conectar con el asistente. Intenta nuevamente.';}});
  }
  get sugerencias():string[]{
    if(!this.consultarDatos)return ['Guíame para hacer una transferencia','¿Cómo solicito un préstamo?','¿Cómo retomo un pago pendiente?'];
    if(this.modo==='ADMIN')return ['Resume las alertas pendientes','¿Qué solicitudes necesitan revisión?','Dame un resumen operativo'];
    const detalle=this.router.url.match(/^\/(transacciones|prestamos)\/(\d+)$/);
    return detalle ? [`Explícame el ${detalle[1]==='prestamos'?'préstamo':'movimiento'} #${detalle[2]}`,'Resume mis movimientos recientes','¿Qué préstamos tengo?'] : ['Resume mis movimientos recientes','¿Qué préstamos tengo?','Resume mis cuentas'];
  }
  cambiarModo(modo:ModoAsistente):void{if(!this.enviando && (modo!=='ADMIN'||this.isAdmin)){this.modo=modo;this.consultarDatos=false;this.limpiar();}}
  cambiarPermiso():void{this.limpiar();}
  limpiar():void{if(this.enviando)return;this.mensajes=[];this.error='';this.pregunta='';}
  preguntar(texto:string):void{this.pregunta=texto;this.enviar();}
  enviar():void{
    if(this.enviando||!this.disponible||!this.pregunta.trim()||this.pregunta.length>1200)return;
    if(this.auth.getSession()?.usuarioId!==this.usuarioId){this.ref.close();return;}
    const pregunta=this.pregunta.trim();const historial:TurnoAsistente[]=this.mensajes.slice(-6).map(m=>({rol:m.rol,texto:m.texto.slice(0,2400)}));
    const request:SolicitudAsistente={mensaje:pregunta,modo:this.modo,consultarDatos:this.consultarDatos,historial};
    this.mensajes.push({rol:'USER',texto:pregunta});this.pregunta='';this.error='';this.enviando=true;this.scroll();
    this.subscriptions.add(this.api.conversar(request).subscribe({next:r=>{
      this.enviando=false;const fuentes=(r.fuentes||[]).filter(f=>/^\/(cuentas|transacciones|prestamos)(\/[1-9]\d*)?$|^\/(dashboard|alertas)$/.test(f.enlace));
      this.mensajes.push({rol:'ASSISTANT',texto:r.respuesta,fuentes,datosConsultados:r.datosConsultados});this.scroll();
    },error:e=>{
      this.enviando=false;this.mensajes.pop();this.pregunta=pregunta;
      this.error=e.error?.message || (e.name==='TimeoutError'?'La consulta tardó demasiado. Prueba con una pregunta más concreta.':'No pudimos completar la consulta. Intenta nuevamente.');
    }}));
  }
  private scroll():void{setTimeout(()=>{const element=this.conversation?.nativeElement;if(element)element.scrollTop=element.scrollHeight;});}
}
