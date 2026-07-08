<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildSeoTitle } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mode = $state<'signin' | 'signup'>('signin');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const title = buildSeoTitle('Login');
	const description = 'Sign in to your Deploylint project workspace.';
	let emailSignupAvailable = $derived(data.auth.emailSignup);

	async function continueWithGitHub() {
		if (!data.auth.github || loading) return;
		loading = true;
		errorMessage = null;
		message = null;

		try {
			await authClient.signIn.social({
				provider: 'github',
				callbackURL: data.redirectTo
			});
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'GitHub login failed.';
			loading = false;
		}
	}

	async function submitEmailPassword() {
		if (loading) return;
		if (mode === 'signup' && !emailSignupAvailable) {
			errorMessage =
				'Account creation is temporarily disabled until verification email is configured.';
			message = null;
			return;
		}

		loading = true;
		errorMessage = null;
		message = null;

		try {
			const result =
				mode === 'signup'
					? await authClient.signUp.email({
							name: name.trim() || email.trim(),
							email: email.trim(),
							password,
							callbackURL: data.redirectTo
						})
					: await authClient.signIn.email({
							email: email.trim(),
							password,
							callbackURL: data.redirectTo
						});

			if (result.error) {
				errorMessage = result.error.message || 'Authentication failed.';
				return;
			}

			if (mode === 'signup') {
				message = 'Check your email to verify the account.';
				return;
			}

			await goto(resolve('/app'));
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Authentication failed.';
		} finally {
			loading = false;
		}
	}
</script>

<SeoHead {title} {description} canonical="/login" />

<div
	class="mx-auto grid min-h-[calc(100vh-220px)] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_420px]"
>
	<section>
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
			Deploylint workspace
		</p>
		<h1 class="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
			Sign in to manage deploy gates.
		</h1>
		<p class="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
			Attach advisory reports, billing, project installs, and GitHub gate state to a monitored
			workspace.
		</p>
	</section>

	<section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl shadow-black/20">
		<div class="flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
			<button
				type="button"
				class="flex-1 rounded-md px-3 py-2 text-sm font-semibold {mode === 'signin'
					? 'bg-zinc-800 text-white'
					: 'text-zinc-500 hover:text-zinc-200'}"
				onclick={() => (mode = 'signin')}
			>
				Sign in
			</button>
			<button
				type="button"
				class="flex-1 rounded-md px-3 py-2 text-sm font-semibold {mode === 'signup'
					? 'bg-zinc-800 text-white'
					: 'text-zinc-500 hover:text-zinc-200 disabled:hover:text-zinc-500'}"
				disabled={!emailSignupAvailable || loading}
				title={emailSignupAvailable
					? 'Create an account'
					: 'Account creation requires verification email to be configured'}
				onclick={() => {
					if (emailSignupAvailable) mode = 'signup';
				}}
			>
				Create account
			</button>
		</div>

		<button
			type="button"
			class="mt-5 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!data.auth.github || loading}
			onclick={continueWithGitHub}
		>
			Continue with GitHub
		</button>

		{#if !data.auth.github}
			<p class="mt-2 text-xs text-amber-300">
				Add GitHub OAuth credentials to enable GitHub login.
			</p>
		{/if}

		<div class="my-5 flex items-center gap-3 text-xs text-zinc-600">
			<span class="h-px flex-1 bg-zinc-800"></span>
			<span>Email</span>
			<span class="h-px flex-1 bg-zinc-800"></span>
		</div>

		<form class="space-y-4" onsubmit={(event) => (event.preventDefault(), submitEmailPassword())}>
			{#if mode === 'signup'}
				<label class="block text-sm font-medium text-zinc-300">
					Name
					<input
						class="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-sky-500"
						autocomplete="name"
						bind:value={name}
					/>
				</label>
			{/if}

			<label class="block text-sm font-medium text-zinc-300">
				Email
				<input
					class="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-sky-500"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
				/>
			</label>

			<label class="block text-sm font-medium text-zinc-300">
				Password
				<input
					class="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-sky-500"
					type="password"
					autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
					minlength="10"
					required
					bind:value={password}
				/>
			</label>

			<button
				type="submit"
				class="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-sky-400 disabled:cursor-wait disabled:opacity-70"
				disabled={loading}
			>
				{mode === 'signup' ? 'Create account' : 'Sign in'}
			</button>
		</form>

		{#if !data.auth.emailDelivery}
			<p class="mt-3 text-xs leading-5 text-amber-300">
				Email sign-in is wired, but new account creation is disabled until verification email is
				configured.
			</p>
		{/if}

		{#if message}
			<p class="mt-4 text-sm text-sky-300" role="status">{message}</p>
		{/if}

		{#if errorMessage}
			<p class="mt-4 text-sm text-red-300" role="alert">{errorMessage}</p>
		{/if}
	</section>
</div>
