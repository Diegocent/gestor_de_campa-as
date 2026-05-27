import "dotenv/config";
import { seedDefaultOrganization } from "@/infrastructure/database/repositories";
import { getDb } from "@/infrastructure/database/client";

async function main() {
  console.log("Ejecutando seed...");
  await seedDefaultOrganization();
  console.log("Organización por defecto creada.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
