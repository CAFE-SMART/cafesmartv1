import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
import { SecadoModule } from './secado/secado.module';
import { CreditoModule } from './compras/credito.module';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { AiModule } from './ai/ai.module';
import { FinancialAccessModule } from './financial-access/financial-access.module';
import { ContactosModule } from './contactos/contactos.module';

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
    SecadoModule,
    AiModule,
    FinancialAccessModule,
    ContactosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
