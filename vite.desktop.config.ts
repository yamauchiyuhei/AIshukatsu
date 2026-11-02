import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { copyFile, rename } from 'node:fs/promises';
const assets=['logo.png','favicon.ico'];
export default defineConfig({plugins:[react(),{name:'desktop-entry',async closeBundle(){await rename('dist-desktop/desktop.html','dist-desktop/index.html');for(const asset of assets){try{await copyFile('public/'+asset,'dist-desktop/'+asset);}catch{ /* optional public asset */ }} }}],publicDir:false,server:{port:5173},build:{outDir:'dist-desktop',rollupOptions:{input:resolve(import.meta.dirname,'desktop.html')}}});
