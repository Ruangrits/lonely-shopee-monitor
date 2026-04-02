<script lang="ts">
	import type { Platform } from '../data'

	let {
		platform = 'shopee' as Platform,
		size = 20
	}: {
		platform?: Platform
		size?: number
	} = $props()

	const logos: Record<string, string> = {
		shopee: '/logos/shopee.png',
		lazada: '/logos/lazada.png',
		tiktok: '/logos/tiktok.png',
	}

	const src = $derived(logos[platform || 'shopee'] || logos.shopee)
</script>

<img {src} alt={platform} width={size} height={size} class="rounded shrink-0" />
