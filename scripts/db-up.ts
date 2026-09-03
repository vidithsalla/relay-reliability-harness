import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dataDir = path.join(process.cwd(), ".relay-pgdata");
const logFile = path.join(dataDir, "postgres.log");

function run(command: string, args: string[], allowFailure = false) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.status ?? 1;
}

function capture(command: string, args: string[]) {
  return spawnSync(command, args, { encoding: "utf8" });
}

async function main() {
  const docker = capture("docker", ["info"]);
  if (docker.status === 0) {
    run("docker", ["compose", "up", "-d", "postgres"]);
    return;
  }

  await mkdir(dataDir, { recursive: true });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    run("initdb", ["-D", dataDir, "-U", "relay", "--auth=trust"]);
  }

  const ready = capture("pg_isready", ["-h", "127.0.0.1", "-p", "5432", "-U", "relay"]);
  if (ready.status !== 0) {
    run("pg_ctl", ["-D", dataDir, "-l", logFile, "-o", "-p 5432", "start"]);
  }

  const dbExists = capture("psql", [
    "-h",
    "127.0.0.1",
    "-p",
    "5432",
    "-U",
    "relay",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname = 'relay'"
  ]);
  if (!dbExists.stdout.includes("1")) {
    run("createdb", ["-h", "127.0.0.1", "-p", "5432", "-U", "relay", "relay"]);
  }
  console.log("local PostgreSQL is ready on 127.0.0.1:5432");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
