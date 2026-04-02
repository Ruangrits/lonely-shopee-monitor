<script lang="ts">
	import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
	import Dashboard from '$lib/modules/dashboard/Dashboard.svelte'
	import { Text, TextStyle, VBox } from 'th-lonely-universe-web-lib/svelte/ui'

	let loggedIn = $state(false)
	let loading = $state(true)
	let error = $state('')

	async function init() {
		loading = true
		error = ''

		// เรียก /api/auth/status ซึ่ง backend จะ auto-launch browser + auto-login จาก .env
		const either = await shopeeOrderService.getAuthStatus().promise

		if (either.isRight) {
			loggedIn = either.getRight().loggedIn
			if (!loggedIn) {
				error = 'ยังไม่ได้ login Shopee — กรุณาตรวจสอบ SHOPEE_USERNAME/PASSWORD ใน .env แล้ว restart backend'
			}
		} else {
			error = 'ไม่สามารถเชื่อมต่อ backend ได้ — กรุณาตรวจสอบว่า backend กำลังทำงานอยู่'
		}

		loading = false
	}

	$effect(() => {
		init()
	})
</script>

{#if loading}
	<div class="flex items-center justify-center min-h-screen">
		<VBox custom="gap-3 items-center">
			<div class="w-8 h-8 border-3 border-primary-300 border-t-transparent rounded-full animate-spin"></div>
			<Text style={TextStyle.Body2}>กำลังเชื่อมต่อ Shopee...</Text>
		</VBox>
	</div>
{:else if loggedIn}
	<Dashboard {loggedIn} />
{:else}
	<div class="flex items-center justify-center min-h-screen">
		<div class="max-w-md p-6 bg-white rounded-xl shadow-lg text-center">
			<VBox custom="gap-4">
				<Text style={TextStyle.H3}>Shopee Order Monitor</Text>
				<div class="p-3 bg-danger-50 text-danger-200 rounded-lg">
					<Text style={TextStyle.Small1}>{error}</Text>
				</div>
				<Text style={TextStyle.Small2}>
					ตั้งค่า SHOPEE_USERNAME และ SHOPEE_PASSWORD ในไฟล์ backend/.env แล้ว restart backend
				</Text>
			</VBox>
		</div>
	</div>
{/if}
