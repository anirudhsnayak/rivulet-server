const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const dotenv = require('dotenv');

async function main() {
  const env = { ...dotenv.parse(readFileSync(resolve(__dirname, '../.env'))), ...process.env };
  for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
    if (!env[key]) throw new Error(`Set ${key} in rivulet-server/.env before starting PostgreSQL.`);
  }
  const port = env.POSTGRES_PORT || '5432';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('POSTGRES_PORT must be between 1 and 65535.');
  }
  // Keep the same container and persistent volume as the original docker.sh.
  const container = env.RIVULET_DB_CONTAINER || 'rivulet-postgres';
  const volume = env.RIVULET_DB_VOLUME || 'rivulet-data';
  const docker = args => {
    const result = spawnSync('docker', args, { env, encoding: 'utf8', windowsHide: true });
    if (result.error) throw new Error(`Cannot run Docker: ${result.error.message}`);
    return result;
  };
  const checked = args => {
    const result = docker(args);
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Docker command failed.');
    return result.stdout.trim();
  };
  if (docker(['info', '--format', '{{.ServerVersion}}']).status !== 0) {
    throw new Error('Docker is unavailable. Start Docker Desktop and try again.');
  }
  const existing = docker(['container', 'inspect', '--format', '{{.State.Running}}', container]);
  if (existing.status === 0) {
    if (existing.stdout.trim() !== 'true') {
      checked(['start', container]);
      console.log(`Started ${container}.`);
    } else console.log(`${container} is already running.`);
  } else {
    // Passing variable names keeps the password out of command-line arguments.
    checked(['run', '--detach', '--name', container,
      '--env', 'POSTGRES_USER', '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_DB',
      '--publish', `127.0.0.1:${port}:5432`,
      '--volume', `${volume}:/var/lib/postgresql`, 'postgres:latest']);
    console.log(`Created ${container} using volume ${volume}.`);
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = docker(['exec', container, 'pg_isready', '--host', '127.0.0.1',
      '--username', env.POSTGRES_USER, '--dbname', env.POSTGRES_DB]);
    if (ready.status === 0) {
      console.log(`PostgreSQL is ready (${container}). Existing containers retain their original port and credentials.`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`PostgreSQL did not become ready within 60 seconds. Check: docker logs ${container}`);
}

main().catch(error => {
  console.error(error.code === 'ENOENT' ? 'Create rivulet-server/.env before starting PostgreSQL.' : error.message);
  process.exitCode = 1;
});
