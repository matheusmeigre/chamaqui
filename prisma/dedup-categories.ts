/**
 * Script de limpeza: remove categorias duplicadas do banco.
 * Para cada nome duplicado, mantém o registro mais antigo e redireciona
 * os tickets dos duplicados para esse registro, depois os deleta.
 *
 * Execute com:  npx ts-node --project tsconfig.json prisma/dedup-categories.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Buscando categorias duplicadas...");

  const all = await prisma.category.findMany({ orderBy: { createdAt: "asc" } });

  // Agrupa por nome, mantendo o mais antigo como canônico
  const groups: Record<string, typeof all> = {};
  for (const cat of all) {
    if (!groups[cat.name]) groups[cat.name] = [];
    groups[cat.name].push(cat);
  }

  let removed = 0;
  for (const [name, cats] of Object.entries(groups)) {
    if (cats.length <= 1) continue;

    const [keep, ...dupes] = cats; // o mais antigo fica
    console.log(
      `  "${name}": mantendo id=${keep.id}, removendo ${dupes.length} duplicata(s)...`
    );

    for (const dupe of dupes) {
      // Redireciona tickets vinculados ao duplicado para o canônico
      await prisma.ticket.updateMany({
        where: { categoryId: dupe.id },
        data: { categoryId: keep.id },
      });
      await prisma.category.delete({ where: { id: dupe.id } });
      removed++;
    }
  }

  if (removed === 0) {
    console.log("✅ Nenhuma duplicata encontrada.");
  } else {
    console.log(`✅ ${removed} categoria(s) duplicada(s) removida(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
