// Starts the database and the dev servers. When the dev servers exit
// (e.g. Ctrl+C), the database container is stopped as well.

const run = (cmd: string[]) =>
  Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] }).exited;

const upCode = await run(["docker", "compose", "up", "-d", "--wait", "db"]);
if (upCode !== 0) process.exit(upCode);

const dev = Bun.spawn(
  ["bun", "run", "--filter", "@finifeed/server", "--filter", "@finifeed/web", "dev"],
  { stdio: ["inherit", "inherit", "inherit"] },
);

// Ctrl+C reaches the dev servers directly (same process group). Keep this
// process alive so it can stop the database after they have shut down.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => dev.kill("SIGTERM"));

const devCode = await dev.exited;
console.log("\nStopping database …");
await run(["docker", "compose", "stop", "db"]);
process.exit(devCode);
