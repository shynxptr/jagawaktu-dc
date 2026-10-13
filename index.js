require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const client = new Client({
    checkUpdate: false,
});

const TOKEN = process.env.TOKEN;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;

// Reconnect settings
const RECONNECT_DELAY = 5000; // 5 detik delay sebelum reconnect
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectAttempts = 0;
let isConnected = false;
let voiceConnection = null;

// Logging helper
function log(message) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] ${message}`);
}

// Join voice channel
async function joinVoice() {
    try {
        const channel = await client.channels.fetch(VOICE_CHANNEL_ID);

        if (!channel) {
            log('❌ Voice channel tidak ditemukan! Cek VOICE_CHANNEL_ID di .env');
            return;
        }

        if (!channel.isVoice()) {
            log('❌ Channel yang dikasih bukan voice channel!');
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
            log(`✅ Berhasil join voice: #${channel.name} (${channel.guild.name})`);
            log(`🔇 Self Mute: ON | 🔊 Self Deaf: OFF`);
        });

        voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            log('⚠️ Voice connection disconnected!');
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
                log('🔄 Auto reconnect dari @discordjs/voice gagal, join ulang...');
                attemptReconnect();
            }
        });

        voiceConnection.on(VoiceConnectionStatus.Destroyed, () => {
            isConnected = false;
            log('🔌 Voice connection destroyed');
        });

    } catch (error) {
        log(`❌ Gagal join voice: ${error.message}`);
        attemptReconnect();
    }
}

// Auto reconnect
async function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        log(`❌ Sudah ${MAX_RECONNECT_ATTEMPTS}x gagal reconnect. Berhenti.`);
        return;
    }

    reconnectAttempts++;
    log(`🔄 Mencoba reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(async () => {
        await joinVoice();
    }, RECONNECT_DELAY);
}

// === EVENT HANDLERS ===

client.on('ready', async () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('   🤖 Discord Voice AFK Selfbot');
    console.log('═══════════════════════════════════════════');
    log(`📡 Logged in sebagai: ${client.user.tag}`);
    log(`🆔 User ID: ${client.user.id}`);
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
    if (oldState.channelId === VOICE_CHANNEL_ID && newState.channelId !== VOICE_CHANNEL_ID) {
        isConnected = false;
        log('⚠️ Terdeteksi keluar dari voice channel!');

        // Kalau di-move ke channel lain, bukan disconnect
        if (newState.channelId) {
            log(`📌 Di-move ke channel lain: ${newState.channel?.name || newState.channelId}`);
        }

        // Auto reconnect ke channel target
        log('🔄 Mencoba kembali ke voice channel target...');
        setTimeout(async () => {
            await joinVoice();
        }, RECONNECT_DELAY);
    }
});

// Handle error biar gak crash
client.on('error', (error) => {
    log(`❌ Client error: ${error.message}`);
});

client.on('warn', (warning) => {
    log(`⚠️ Warning: ${warning}`);
});

// Handle disconnect
client.on('disconnect', () => {
    log('⚠️ Client disconnected dari Discord');
});

// Handle reconnecting
client.on('reconnecting', () => {
    log('🔄 Client reconnecting ke Discord...');
});

// Graceful shutdown
process.on('SIGINT', () => {
    log('👋 Shutting down selfbot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('👋 Shutting down selfbot...');
    client.destroy();
    process.exit(0);
});

// Handle unhandled errors biar gak crash
process.on('unhandledRejection', (error) => {
    log(`❌ Unhandled rejection: ${error.message || error}`);
});

// Login
if (!TOKEN || TOKEN === 'YOUR_DISCORD_TOKEN_HERE') {
    console.log('');
    console.log('❌ TOKEN belum diisi!');
    console.log('   Buka file .env dan isi TOKEN dengan token Discord kamu');
    console.log('   Cara dapat token:');
    console.log('   1. Buka Discord di browser');
    console.log('   2. Tekan F12 (Developer Tools)');
    console.log('   3. Buka tab Console');
    console.log('   4. Ketik: webpackChunkdiscord_app.push([[],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]);m.find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()');
    console.log('');
    process.exit(1);
}

if (!VOICE_CHANNEL_ID || VOICE_CHANNEL_ID === 'YOUR_VOICE_CHANNEL_ID_HERE') {
    console.log('');
    console.log('❌ VOICE_CHANNEL_ID belum diisi!');
    console.log('   Buka file .env dan isi dengan ID voice channel yang mau di-join');
    console.log('   Cara dapat Channel ID:');
    console.log('   1. Buka Discord Settings > Advanced > Enable Developer Mode');
    console.log('   2. Klik kanan voice channel > Copy Channel ID');
    console.log('');
    process.exit(1);
}

log('🚀 Starting selfbot...');
client.login(TOKEN);
