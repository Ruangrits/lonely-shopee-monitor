<script lang="ts">
	import { Text, TextStyle } from 'th-lonely-universe-web-lib/svelte/ui'

	let {
		loggedIn = false
	}: {
		loggedIn?: boolean
	} = $props()
</script>

<div class="flex items-center gap-2">
	<div class="w-3 h-3 rounded-full {loggedIn ? 'bg-success-200' : 'bg-danger-200'}"></div>
	<Text style={TextStyle.Small1}>
		{loggedIn ? 'เชื่อมต่อ Shopee แล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
	</Text>
</div>
