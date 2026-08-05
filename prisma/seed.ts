import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter });

const categories = [
  { name: 'Acesso', description: 'Dificuldades com senhas, permissões, login ou controle de acesso a sistemas e ferramentas.' },
  { name: 'Aplicação', description: 'Erros ou falhas em aplicações web (frontend e/ou backend), APIs, formulários ou sistemas internos.' },
  { name: 'Hardware', description: 'Problemas com equipamentos físicos como computadores, impressoras, monitores, teclados, mouses etc.' },
  { name: 'Infraestrutura', description: 'Falhas em servidores, data centers, fornecimento de energia ou estrutura física de TI.' },
  { name: 'Outros', description: 'Demandas que não se enquadram nas categorias listadas acima.' },
  { name: 'Rede', description: 'Problemas de conectividade, internet, Wi-Fi, VPN ou acesso à rede corporativa.' },
  { name: 'Software', description: 'Erros, falhas ou dúvidas em programas instalados, licenças ou configurações de software.' },
];

async function main() {
  console.log('Iniciando o seeder...');

  // Categorias base (o nome é único no banco, então o upsert é idempotente)
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description, defaultSlaHours: 24 },
      create: { name: cat.name, description: cat.description, defaultSlaHours: 24 },
    });
  }
  console.log('✅ Categorias criadas/verificadas.');

  // As identidades ficam no banco, mas as chaves de acesso existem somente no ambiente.
  const admin = await prisma.user.upsert({
    where: { email: 'hdl@chamaqui.local' },
    update: { name: 'HDL', role: 'ADMINISTRADOR' },
    create: {
      email: 'hdl@chamaqui.local',
      name: 'HDL',
      role: 'ADMINISTRADOR',
    },
  });

  console.log(`✅ Admin criado/verificado: ${admin.email}`);

  const solicitante = await prisma.user.upsert({
    where: { email: 'instituto.energisa@chamaqui.local' },
    update: { name: 'Instituto Energisa', role: 'SOLICITANTE' },
    create: {
      email: 'instituto.energisa@chamaqui.local',
      name: 'Instituto Energisa',
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
