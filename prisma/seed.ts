import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando o seeder...');

  // Criar Categorias Base
  const categories = ['Hardware', 'Software', 'Rede', 'Acesso', 'Infraestrutura', 'Outros'];
  for (const catName of categories) {
    await prisma.category.upsert({
      where: { id: catName }, // Fake id for upsert check, better use name if unique, but Category id is UUID. We'll findFirst instead.
      update: {},
      create: { name: catName, description: `Categoria para chamados de ${catName}`, defaultSlaHours: 24 }
    }).catch(async () => {
      const exists = await prisma.category.findFirst({ where: { name: catName } });
      if (!exists) {
        await prisma.category.create({
          data: { name: catName, description: `Categoria para chamados de ${catName}`, defaultSlaHours: 24 }
        });
      }
    });
  }
  console.log('✅ Categorias criadas/verificadas.');

  const passwordHash = await bcrypt.hash('123456', 10);

  // Criar Usuário Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@chamaqui.com' },
    update: {},
    create: {
      email: 'admin@chamaqui.com',
      name: 'Administrador do Sistema',
      passwordHash,
      role: 'ADMINISTRADOR',
    },
  });

  console.log(`✅ Admin criado/verificado: ${admin.email}`);

  // Criar Usuário Atendente
  const atendente = await prisma.user.upsert({
    where: { email: 'atendente@chamaqui.com' },
    update: {},
    create: {
      email: 'atendente@chamaqui.com',
      name: 'Técnico Suporte N1',
      passwordHash,
      role: 'ATENDENTE',
    },
  });

  console.log(`✅ Atendente criado/verificado: ${atendente.email}`);

  // Criar Usuário Solicitante
  const solicitante = await prisma.user.upsert({
    where: { email: 'solicitante@chamaqui.com' },
    update: {},
    create: {
      email: 'solicitante@chamaqui.com',
      name: 'Cliente Final',
      passwordHash,
      role: 'SOLICITANTE',
    },
  });

  console.log(`✅ Solicitante criado/verificado: ${solicitante.email}`);
  
  console.log('🌱 Banco Populado com Sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
