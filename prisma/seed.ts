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
  // Remove duplicatas mantendo o registro mais antigo de cada nome
  const allCategories = await prisma.category.findMany({ orderBy: { createdAt: 'asc' } });
  const seen = new Set<string>();
  for (const cat of allCategories) {
    if (seen.has(cat.name)) {
      await prisma.ticket.updateMany({ where: { categoryId: cat.id }, data: {} }); // tickets sem referência serão mantidos
      await prisma.category.delete({ where: { id: cat.id } }).catch(() => {}); // ignora se houver tickets vinculados
    } else {
      seen.add(cat.name);
    }
  }
  console.log('✅ Categorias criadas/verificadas (duplicatas removidas).');

  // As identidades ficam no banco, mas as chaves de acesso existem somente no ambiente.
  const orgHdl = await prisma.organization.upsert({
    where: { slug: 'hdl' },
    update: { name: 'HDL Soluções', email: 'hdl@chamaqui.local', enabled: true },
    create: {
      slug: 'hdl',
      name: 'HDL Soluções',
      email: 'hdl@chamaqui.local',
      enabled: true,
    },
  });

  const orgInstituto = await prisma.organization.upsert({
    where: { slug: 'instituto-energisa' },
    update: { name: 'Instituto Energisa', email: 'instituto.energisa@chamaqui.local', enabled: true },
    create: {
      slug: 'instituto-energisa',
      name: 'Instituto Energisa',
      email: 'instituto.energisa@chamaqui.local',
      enabled: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'hdl@chamaqui.local' },
    update: { name: 'HDL', role: 'ADMINISTRADOR', organizationId: orgHdl.id },
    create: {
      email: 'hdl@chamaqui.local',
      name: 'HDL',
      role: 'ADMINISTRADOR',
      organizationId: orgHdl.id,
    },
  });

  console.log(`✅ Admin criado/verificado: ${admin.email} (org ${orgHdl.slug})`);

  const solicitante = await prisma.user.upsert({
    where: { email: 'instituto.energisa@chamaqui.local' },
    update: { name: 'Instituto Energisa', role: 'SOLICITANTE', organizationId: orgInstituto.id },
    create: {
      email: 'instituto.energisa@chamaqui.local',
      name: 'Instituto Energisa',
      role: 'SOLICITANTE',
      organizationId: orgInstituto.id,
    },
  });

  console.log(`✅ Solicitante criado/verificado: ${solicitante.email} (org ${orgInstituto.slug})`);

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
