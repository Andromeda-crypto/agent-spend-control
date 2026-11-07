import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const toolVersion='v1.58';
const solanaBin=process.env.SOLANA_BIN??join(homedir(),'.local/share/solana/install/active_release/bin');
const builder=existsSync(join(solanaBin,'cargo-build-sbf'))?join(solanaBin,'cargo-build-sbf'):'cargo-build-sbf';
const toolBin=join(homedir(),'.cache/solana',toolVersion,'platform-tools/rust/bin');
const compiler=join(toolBin,'rustc');
const args=['--manifest-path','programs/spending-vault/Cargo.toml','--tools-version',toolVersion,'--no-rustup-override'];
async function run(env:NodeJS.ProcessEnv){const child=spawn(builder,args,{stdio:'inherit',env});const [code]=await once(child,'exit');return typeof code==='number'?code:1;}
// The builder downloads its pinned platform tools before checking the host target.
// On a Homebrew Rust setup that first invocation may report a host-target error.
if(!existsSync(compiler)){
  console.log(`Installing Solana platform tools ${toolVersion}.`);
  await run(process.env);
  if(!existsSync(compiler))throw new Error('SBF tool setup failed; install the official Solana CLI and retry.');
}
process.exitCode=await run({...process.env,RUSTC:compiler,PATH:`${toolBin}:${process.env.PATH??''}`});
