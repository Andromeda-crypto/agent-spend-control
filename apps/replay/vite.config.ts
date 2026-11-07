import { defineConfig } from 'vite';
export default defineConfig({cacheDir:'node_modules/.vite/replay',base:process.env.REPLAY_BASE??'/',server:{host:'127.0.0.1',port:5176},build:{outDir:'dist',emptyOutDir:true}});
