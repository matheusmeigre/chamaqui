import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando o seeder...');

  // Criar Categorias Base
  const categories = [
    { name: 'Acesso',         description: 'Dificuldades com senhas, permissões, login ou controle de acesso a sistemas e ferramentas.',           defaultSlaHours: 24 },
    { name: 'Aplicação',      description: 'Erros ou falhas em aplicações web (frontend e/ou backend), APIs, formulários ou sistemas internos.',     defaultSlaHours: 24 },
    { name: 'Hardware',       description: 'Problemas com equipamentos físicos como computadores, impressoras, monitores, teclados, mouses etc.',    defaultSlaHours: 24 },
    { name: 'Infraestrutura', description: 'Falhas em servidores, data centers, fornecimento de energia ou estrutura física de TI.',                  defaultSlaHours: 24 },
    { name: 'Outros',         description: 'Demandas que não se enquadram nas categorias listadas acima.',                                            defaultSlaHours: 24 },
    { name: 'Rede',           description: 'Problemas de conectividade, internet, Wi-Fi, VPN ou acesso à rede corporativa.',                          defaultSlaHours: 24 },
    { name: 'Software',       description: 'Erros, falhas ou dúvidas em programas instalados, licenças ou configurações de software.',               defaultSlaHours: 24 },
  ];
  for (const cat of categories) {
    const exists = await prisma.category.findFirst({ where: { name: cat.name } });
    if (!exists) {
      await prisma.category.create({ data: cat });
    }
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
