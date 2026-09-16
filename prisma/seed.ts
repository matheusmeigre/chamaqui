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

// ----------------------------------------------------------------------------
// Calendário de feriados do relógio de SLA em horas úteis
// ----------------------------------------------------------------------------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

type SeedHoliday = { date: Date; name: string; scope: 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL'; municipality?: string };

/**
 * Feriados nacionais (fixos e móveis) e o estadual de MG. Os feriados
 * municipais de Cataguases, Itamarati de Minas e Leopoldina/Piacatuba NÃO são
 * semeados aqui: as datas variam por lei municipal e precisam ser cadastradas
 * na tabela Holiday antes da primeira apuração em produção. Semear datas
 * presumidas falsearia o relógio de SLA.
 */
function holidaysForYear(year: number): SeedHoliday[] {
  const easter = easterSunday(year);

  return [
    { date: new Date(Date.UTC(year, 0, 1)), name: `Confraternização Universal ${year}`, scope: 'NACIONAL' },
    { date: addDays(easter, -48), name: `Carnaval (segunda) ${year}`, scope: 'NACIONAL' },
    { date: addDays(easter, -47), name: `Carnaval (terça) ${year}`, scope: 'NACIONAL' },
    { date: addDays(easter, -46), name: `Quarta-feira de Cinzas ${year}`, scope: 'NACIONAL' },
    { date: addDays(easter, -2), name: `Sexta-feira Santa ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 3, 21)), name: `Tiradentes ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 4, 1)), name: `Dia do Trabalho ${year}`, scope: 'NACIONAL' },
    { date: addDays(easter, 60), name: `Corpus Christi ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 8, 7)), name: `Independência do Brasil ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 9, 12)), name: `Nossa Senhora Aparecida ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 10, 2)), name: `Finados ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 10, 15)), name: `Proclamação da República ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 10, 20)), name: `Consciência Negra ${year}`, scope: 'NACIONAL' },
    { date: new Date(Date.UTC(year, 11, 25)), name: `Natal ${year}`, scope: 'NACIONAL' },
    // Minas Gerais adota Tiradentes como data magna estadual; já coberto acima
    // pelo feriado nacional de mesma data.
  ];
}

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

  // --------------------------------------------------------------------------
  // Grade de Chamados: contrato de sustentação e calendário de feriados
  // --------------------------------------------------------------------------

  // O contrato pertence à organização contratante. A faixa Padrão é a
  // recomendada na grade: 80 h/mês, reserva de 20 h para C1 e 10 h para P1.
  const contract = await prisma.supportContract.upsert({
    where: { organizationId: orgInstituto.id },
    update: { tier: 'PADRAO', capacityHours: 80, active: true },
    create: {
      organizationId: orgInstituto.id,
      tier: 'PADRAO',
      capacityHours: 80,
      active: true,
    },
  });

  console.log(`✅ Contrato de sustentação (faixa ${contract.tier}, ${contract.capacityHours} h/mês) para ${orgInstituto.slug}`);

  const currentYear = new Date().getUTCFullYear();
  const holidays = [
    ...holidaysForYear(currentYear),
    ...holidaysForYear(currentYear + 1),
  ];

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: { date_name: { date: holiday.date, name: holiday.name } },
      update: { scope: holiday.scope, municipality: holiday.municipality ?? null },
      create: {
        date: holiday.date,
        name: holiday.name,
        scope: holiday.scope,
        municipality: holiday.municipality ?? null,
      },
    });
  }

  console.log(`✅ ${holidays.length} feriados nacionais semeados (${currentYear}–${currentYear + 1}).`);
  console.log('⚠️  Feriados municipais de Cataguases, Itamarati de Minas e Leopoldina/Piacatuba');
  console.log('   precisam ser cadastrados na tabela Holiday antes da primeira apuração real.');

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
