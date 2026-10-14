require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

// Reconnect settings
const RECONNECT_DELAY = 5000; // 5 detik delay sebelum reconnect
const MAX_RECONNECT_ATTEMPTS = 10;

// Logging helper
function log(label, message) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] [${label}] ${message}`);
}

// Parse accounts from .env
function parseAccounts() {
    const accounts = [];

    // Support format: TOKEN_1, CHANNEL_1, TOKEN_2, CHANNEL_2, ...
    for (let i = 1; i <= 100; i++) {
        const token = process.env[`TOKEN_${i}`];
        const channel = process.env[`CHANNEL_${i}`];

        if (token && channel) {
            accounts.push({ token, channelId: channel, label: `Akun-${i}` });
        } else {
            break; // Stop kalau gak ada lagi
        }
    }

    // Fallback: support single TOKEN / VOICE_CHANNEL_ID (format lama)
    if (accounts.length === 0) {
        const token = process.env.TOKEN;
        const channel = process.env.VOICE_CHANNEL_ID;

        if (token && token !== 'YOUR_DISCORD_TOKEN_HERE' && channel && channel !== 'YOUR_VOICE_CHANNEL_ID_HERE') {
            accounts.push({ token, channelId: channel, label: 'Akun-1' });
        }
    }

    return accounts;
}

// Create a selfbot instance for one account
function createBotInstance({ token, channelId, label }) {
    const client = new Client({ checkUpdate: false });

    let reconnectAttempts = 0;
    let isConnected = false;
    let voiceConnection = null;

    // Join voice channel
    async function joinVoice() {
        try {
            const channel = await client.channels.fetch(channelId);

            if (!channel) {
                log(label, '❌ Voice channel tidak ditemukan! Cek CHANNEL_ID di .env');
                return;
            }

            if (!channel.isVoice()) {
                log(label, '❌ Channel yang dikasih bukan voice channel!');
                return;
            }

            // Join voice channel pakai @discordjs/voice
            voiceConnection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfMute: true,
                selfDeaf: false,
            });

            // Listen for connection state changes
            voiceConnection.on(VoiceConnectionStatus.Ready, () => {
                isConnected = true;
                reconnectAttempts = 0;
                log(label, `✅ Berhasil join voice: #${channel.name} (${channel.guild.name})`);
                log(label, `🔇 Self Mute: ON | 🔊 Self Deaf: OFF`);
            });

            voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
                log(label, '⚠️ Voice connection disconnected!');
                try {
                    // Coba reconnect otomatis dari @discordjs/voice
                    await Promise.race([
                        entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                    // Seems to be reconnecting
                } catch (error) {
                    // Kalau gagal reconnect, destroy dan join ulang
                    voiceConnection.destroy();
                    isConnected = false;
                    log(label, '🔄 Auto reconnect dari @discordjs/voice gagal, join ulang...');
                    attemptReconnect();
                }
            });

            voiceConnection.on(VoiceConnectionStatus.Destroyed, () => {
                isConnected = false;
                log(label, '🔌 Voice connection destroyed');
            });

        } catch (error) {
            log(label, `❌ Gagal join voice: ${error.message}`);
            attemptReconnect();
        }
    }

    // Auto reconnect
    async function attemptReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log(label, `❌ Sudah ${MAX_RECONNECT_ATTEMPTS}x gagal reconnect. Berhenti.`);
            return;
        }

        reconnectAttempts++;
        log(label, `🔄 Mencoba reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

        setTimeout(async () => {
            await joinVoice();
        }, RECONNECT_DELAY);
    }

    // === EVENT HANDLERS ===

    client.on('ready', async () => {
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log(`   🤖 [${label}] Discord Voice AFK Selfbot`);
        console.log('═══════════════════════════════════════════');
        log(label, `📡 Logged in sebagai: ${client.user.tag}`);
        log(label, `🆔 User ID: ${client.user.id}`);
        log(label, `🎯 Target Channel: ${channelId}`);
        console.log('═══════════════════════════════════════════');
        console.log('');

        // Join voice channel saat ready
        await joinVoice();
    });

    // Detect kalau di-disconnect dari voice (misal di-kick, server issue, dll)
    client.on('voiceStateUpdate', (oldState, newState) => {
        // Cek apakah ini state update untuk akun kita sendiri
        if (oldState.member?.id !== client.user.id) return;

        // Kalau sebelumnya di voice channel target, tapi sekarang keluar
        if (oldState.channelId === channelId && newState.channelId !== channelId) {
            isConnected = false;
            log(label, '⚠️ Terdeteksi keluar dari voice channel!');

            // Kalau di-move ke channel lain, bukan disconnect
            if (newState.channelId) {
                log(label, `📌 Di-move ke channel lain: ${newState.channel?.name || newState.channelId}`);
            }

            // Auto reconnect ke channel target
            log(label, '🔄 Mencoba kembali ke voice channel target...');
            setTimeout(async () => {
                await joinVoice();
            }, RECONNECT_DELAY);
        }
    });

    // Handle error biar gak crash
    client.on('error', (error) => {
        log(label, `❌ Client error: ${error.message}`);
    });

    client.on('warn', (warning) => {
        log(label, `⚠️ Warning: ${warning}`);
    });

    // Handle disconnect
    client.on('disconnect', () => {
        log(label, '⚠️ Client disconnected dari Discord');
    });

    // Handle reconnecting
    client.on('reconnecting', () => {
        log(label, '🔄 Client reconnecting ke Discord...');
    });

    // Login
    log(label, '🚀 Starting...');
    client.login(token);

    return client;
}

// =====================================================
// MAIN
// =====================================================

const accounts = parseAccounts();

if (accounts.length === 0) {
    console.log('');
    console.log('❌ Tidak ada akun yang dikonfigurasi!');
    console.log('');
    console.log('   Format multi-akun di .env:');
    console.log('   TOKEN_1=token_discord_pertama');
    console.log('   CHANNEL_1=id_voice_channel_pertama');
    console.log('   TOKEN_2=token_discord_kedua');
    console.log('   CHANNEL_2=id_voice_channel_kedua');
    console.log('   ... dst');
    console.log('');
    console.log('   Atau format lama (single akun):');
    console.log('   TOKEN=token_discord');
    console.log('   VOICE_CHANNEL_ID=id_voice_channel');
    console.log('');
    process.exit(1);
}

console.log('');
console.log('╔═══════════════════════════════════════════╗');
console.log('║   🤖 Discord Voice AFK - Multi Account   ║');
console.log('╠═══════════════════════════════════════════╣');
console.log(`║   📋 Total akun: ${String(accounts.length).padEnd(24)}║`);
accounts.forEach((acc, i) => {
    console.log(`║   ${acc.label}: Channel ${acc.channelId.substring(0, 14)}...  ║`);
});
console.log('╚═══════════════════════════════════════════╝');
console.log('');

// Start semua akun
const clients = accounts.map(acc => createBotInstance(acc));

// Graceful shutdown - destroy semua clients
process.on('SIGINT', () => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] 👋 Shutting down semua akun...`);
    clients.forEach(c => c.destroy());
    process.exit(0);
});

process.on('SIGTERM', () => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] 👋 Shutting down semua akun...`);
    clients.forEach(c => c.destroy());
    process.exit(0);
});

// Handle unhandled errors biar gak crash
process.on('unhandledRejection', (error) => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] ❌ Unhandled rejection: ${error.message || error}`);
});
