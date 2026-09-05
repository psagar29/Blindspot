import { loadConfig } from './config';
import { Providers, ProviderError, FALLBACK_PROMPT } from './providers';
import { runConvex, seedDemo, publishDemo } from './backend';
import { restoreDemo } from './restore';

const config = loadConfig();
const providers = new Providers(config);
async function main() {
  const command = process.argv[2];
  if (command === 'restore-demo') {console.log(JSON.stringify(await restoreDemo(config)));return;}
  if (command === 'publish-demo') {console.log(JSON.stringify(await publishDemo(config,process.argv[3])));return;}
  if (command === 'deploy-dev') { console.log(await runConvex(config, ['dev', '--once', '--typecheck', 'enable', '--tail-logs', 'disable'])); return; }
  if (command === 'seed-demo') { console.log(JSON.stringify(await seedDemo(config))); return; }
  if (command === 'preflight') { console.log(JSON.stringify(await providers.preflight())); return; }
  if (command === 'cache-demo') {
    if (!process.argv.includes('--generate')) throw new ProviderError('OPERATOR_ACTION', 'Pass --generate to authorize the bounded first-cache preparation. Existing jobs are always resumed.');
    const checks = await providers.preflight() as { marble?: { creditsAvailable?: boolean } };
    if (!checks.marble?.creditsAvailable) { console.log(JSON.stringify({ provider:'marble', status: 'credits_unavailable' })); return; }
    let job = await providers.start('marble', FALLBACK_PROMPT);
    console.log(JSON.stringify({ provider:'marble', jobId: job.id, taskId: job.providerTaskId, status: job.status }));
    const deadline = Date.now() + 15 * 60 * 1000;
    while (job.status === 'running' && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      try { job = await providers.poll(job.id); }
      catch (e) { console.log(JSON.stringify({ provider:'marble', status: 'poll_paused', code: e instanceof ProviderError ? e.code : 'NETWORK' })); continue; }
      console.log(JSON.stringify({ provider:'marble', status: job.status }));
    }
    await providers.cacheResult(job);
    if (job.status !== 'completed') process.exitCode = 1;
    return;
  }
  throw new ProviderError('COMMAND', 'Supported commands: preflight, restore-demo, cache-demo --generate, deploy-dev, seed-demo, publish-demo [runId].');
}
main().catch(e => {
  let message = e instanceof Error ? e.message : 'Local operation failed.';
  for (const secret of [config.worldKey, config.deployKey, config.modelKey]) if (secret) message = message.split(secret).join('[redacted]');
  message = message.replace(/https?:\/\/\S+/g, '[service]').replace(/(?:token|authorization|key)["']?\s*[:=]\s*["']?[^\s,"'}]+/gi, '[redacted]');
  console.error(JSON.stringify({ code: e instanceof ProviderError ? e.code : 'LOCAL_ERROR', message: message.slice(-2500) })); process.exitCode = 1;
});
