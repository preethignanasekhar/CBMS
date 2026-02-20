import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
        plugins: [react()],
        base: '/',
        server: {
            port: 3000,
            open: true,
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:5000',
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                    configure: (proxy, _options) => {
                        proxy.on('error', (err, _req, _res) => {
                            console.log('proxy error', err);
                        });
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            console.log('Sending Request to the Target:', req.method, req.url);
                        });
                        proxy.on('proxyRes', (proxyRes, req, _res) => {
                            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                        });
                    },
                },
                '/uploads': {
                    target: 'http://127.0.0.1:5000',
                    changeOrigin: true,
                    secure: false,
                },
                '/socket.io': {
                    target: 'http://127.0.0.1:5000',
                    ws: true,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        build: {
            outDir: 'dist',
        },
        css: {
            preprocessorOptions: {
                shared: {
                    api: 'modern'
                },
                scss: {
                    api: 'modern',
                }
            }
        },
        envPrefix: 'REACT_APP_',
    };
});
