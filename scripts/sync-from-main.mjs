import { execSync } from 'child_process';

function run(cmd) {
  console.log(`> ${cmd}`);
  const output = execSync(cmd, { cwd: '/vercel/share/v0-project', encoding: 'utf8' });
  if (output) console.log(output);
  return output;
}

try {
  run('git fetch origin main');
  run('git merge origin/main --no-edit');
  console.log('Successfully synced latest from origin/main.');
} catch (err) {
  console.error('Error syncing from main:', err.message);
  process.exit(1);
}
