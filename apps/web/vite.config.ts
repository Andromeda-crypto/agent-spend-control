import { defineConfig } from 'vite';
export default defineConfig({cacheDir:'node_modules/.vite/web', server:{host:'127.0.0.1',port:5173,proxy:{'/replay':{target:process.env.REPLAY_TARGET??'http://127.0.0.1:5176',changeOrigin:false},'/api':{target:process.env.GATEWAY_TARGET??'http://127.0.0.1:3001',changeOrigin:false}}},build:{outDir:'dist',emptyOutDir:true} });
