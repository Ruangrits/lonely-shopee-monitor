import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: [
				// lonely-web-lib (local dependency — fonts, icons, theme)
				path.resolve('../lonely-web-lib'),
			]
		},
		allowedHosts: ['llmnt.sytes.net']
	}
});
