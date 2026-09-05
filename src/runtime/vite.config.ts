import { defineConfig, mergeConfig } from 'vite';
import baseline from '../../vite.config';

// B's isolated harness adds the protected local-service proxy without editing A's root config.
export default defineConfig(async env=>mergeConfig(typeof baseline==='function'?await baseline(env):baseline,{
  server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api/local':{target:'http://127.0.0.1:8788',changeOrigin:false}}},
}));
