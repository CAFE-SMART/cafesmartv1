import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ComprasModule } from './compras/compras.module';
import { ParametrosModule } from './parametros/parametros.module';
import { LotesModule } from './lotes/lotes.module';
import { VentasModule } from './ventas/ventas.module';
import { GastosModule } from './gastos/gastos.module';
import { BodegaModule } from './bodega/bodega.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProductoresModule } from './productores/productores.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ComprasModule,
    ParametrosModule,
    LotesModule,
    VentasModule,
    GastosModule,
    BodegaModule,
    ClientesModule,
    ProductoresModule,
    DashboardModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
