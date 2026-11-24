import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Notificacion, NotificacionService } from '../../services/notificacion.service';

@Component({
  standalone:true,
  imports:[CommonModule],
  template:`
    <div class="page-container inbox">
      <header><div><span class="eyebrow">Tu actividad</span><h1>Notificaciones</h1><p>Pagos, movimientos y novedades de tus préstamos, en un solo lugar.</p></div><button type="button" class="filter-clear" [disabled]="loading || procesando || !items.length || !api.noLeidas()" (click)="leerTodas()">Marcar todas como leídas</button></header>
      <section class="inbox-toolbar" aria-label="Filtros de notificaciones"><div class="inbox-tabs"><button type="button" [attr.aria-pressed]="!soloNoLeidas" (click)="filtrar(false)">Todas</button><button type="button" [attr.aria-pressed]="soloNoLeidas" (click)="filtrar(true)">No leídas <span>{{api.noLeidas()}}</span></button></div><button type="button" class="filter-clear" (click)="cargar()" [disabled]="loading || procesando">Actualizar</button></section>
      <div role="alert" class="form-feedback" *ngIf="error">{{error}} <button type="button" class="filter-clear" (click)="cargar()">Reintentar</button></div>
      <p role="status" class="inbox-empty" *ngIf="loading">Cargando tus notificaciones…</p>
      <p class="inbox-empty" *ngIf="!loading && !error && !items.length">{{soloNoLeidas ? 'Estás al día. No tienes notificaciones sin leer.' : 'Aún no tienes notificaciones. Aquí aparecerán tus próximos movimientos y novedades.'}}</p>
      <section class="inbox-list" aria-label="Listado de notificaciones" *ngIf="!loading && items.length">
        <article *ngFor="let n of items; trackBy:trackId" [class.unread]="!n.leidaEn"><span class="unread-dot" [class.visible]="!n.leidaEn" aria-hidden="true"></span><div class="notification-copy"><div class="notification-heading"><h2>{{n.titulo}}</h2><time [attr.datetime]="n.fechaEvento">{{n.fechaEvento | date:'dd/MM/yyyy HH:mm'}}</time></div><p>{{n.mensaje}}</p><div class="notification-actions"><button type="button" class="notification-link" (click)="abrir(n)" [disabled]="procesando" [attr.aria-label]="'Ver detalle: '+n.titulo">Ver detalle</button><button type="button" class="filter-clear" *ngIf="!n.leidaEn" (click)="marcar(n)" [disabled]="procesando" [attr.aria-label]="'Marcar como leída: '+n.titulo">Marcar como leída</button><span *ngIf="n.leidaEn" class="read-label">Leída</span></div></div></article>
      </section>
      <nav class="inbox-pager" aria-label="Páginas de notificaciones" *ngIf="totalPages>1"><button type="button" class="filter-clear" [disabled]="loading || procesando || page===0" (click)="cambiarPagina(page-1)">Anterior</button><span>Página {{page+1}} de {{totalPages}}</span><button type="button" class="filter-clear" [disabled]="loading || procesando || page+1>=totalPages" (click)="cambiarPagina(page+1)">Siguiente</button></nav>
      <p class="inbox-note">Los avisos se actualizan automáticamente en la campana. Para revisar el estado actual de una operación, abre su detalle.</p>
    </div>
  `,
  styleUrl:'./notificaciones.component.css'
})
export class NotificacionesComponent implements OnInit,OnDestroy {
  items:Notificacion[]=[];loading=true;procesando=false;error='';soloNoLeidas=false;page=0;totalPages=0;
  private hastaId=0;
  private consultas=new Subscription();private lista?:Subscription;
  constructor(public api:NotificacionService,private router:Router){}
  ngOnInit():void{this.cargar();}
  ngOnDestroy():void{this.lista?.unsubscribe();this.consultas.unsubscribe();}
  trackId(_:number,n:Notificacion):number{return n.id;}
  cargar():void{
    this.lista?.unsubscribe();this.loading=true;this.error='';
    this.lista=this.api.listar(this.page,this.soloNoLeidas).subscribe({next:r=>{
      if(this.page>0 && this.page>=r.totalPages){this.page=Math.max(0,r.totalPages-1);this.cargar();return;}
      this.items=r.content;this.totalPages=r.totalPages;this.loading=false;
      if(this.page===0)this.hastaId=Math.max(0,...r.content.map(n=>n.id));
    },error:()=>{this.loading=false;this.items=[];this.error='No pudimos cargar tus notificaciones. Intenta nuevamente.';}});
    this.contar();
  }
  private contar():void{this.consultas.add(this.api.actualizarContador().subscribe({error:()=>{}}));}
  filtrar(noLeidas:boolean):void{if(this.procesando)return;this.soloNoLeidas=noLeidas;this.page=0;this.cargar();}
  cambiarPagina(page:number):void{this.page=page;this.cargar();}
  marcar(n:Notificacion,abrir=false):void{
    if(this.procesando)return;
    if(n.leidaEn){if(abrir)this.navegar(n);return;}
    this.procesando=true;this.error='';
    this.consultas.add(this.api.leer(n.id).subscribe({next:()=>{
      this.procesando=false;if(abrir){this.contar();this.navegar(n);}else this.cargar();
    },error:()=>{this.procesando=false;this.error='No se pudo marcar la notificación como leída. Intenta nuevamente.';}}));
  }
  abrir(n:Notificacion):void{this.marcar(n,true);}
  private navegar(n:Notificacion):void{
    if(/^\/(prestamos|transacciones)\/[1-9]\d*$/.test(n.enlace))this.router.navigateByUrl(n.enlace);
    else this.error='No se pudo abrir el enlace de esta notificación.';
  }
  leerTodas():void{
    if(this.procesando||!this.items.length)return;
    const hastaId=this.hastaId || Math.max(...this.items.map(n=>n.id));this.procesando=true;this.error='';
    this.consultas.add(this.api.leerTodas(hastaId).subscribe({next:()=>{this.procesando=false;this.page=0;this.cargar();},error:()=>{this.procesando=false;this.error='No se pudieron marcar las notificaciones. Intenta nuevamente.';}}));
  }
}
