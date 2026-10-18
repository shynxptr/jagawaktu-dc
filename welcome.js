require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');

// =====================================================
// KONFIGURASI - GANTI INI!
// =====================================================
const WELCOME_CHANNEL_ID = 'YOUR_TEXT_CHANNEL_ID_HERE'; // ⚠️ Ganti dengan ID channel text tempat welcome dikirim
// =====================================================

// Logging helper
function log(message) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] [Welcome] ${message}`);
}

// Random delay biar gak kelihatan kayak bot (langsung balas gitu)
function humanDelay(min = 2000, max = 6000) {
    return Math.floor(Math.random() * (max - min)) + min;
}

// Template pesan welcome santai - dipilih random tiap ada yang join
// {user} = mention user, {name} = nama user tanpa mention
const WELCOME_TEMPLATES = [
    'welcome yaaaa {user}!  semoga betah di murphy.',
    'welcome yaa di server Murphy's {user} ! selamat datang yawww',
    'wlecome {user} !',
    'yo {user}, welcome yaa! feel free to join the chat or voice, jangan lupa baca rules yaa',
    '{user} semoga betah dan enjoy disini yaa, jangan malu² buat nimbrung okeyy!',
    'halo {user} jgn ragu jgm bimbang masuk murphy udh psti disayang',
    'welcomeee cuyyy ! {user} selamat dtgdi murphy',
    '{user} haii, welcome yaa! feel free to join the chat or voice, jangan lupa baca rules yaa',
    'welcome {user} to murphy enjoy yaa jangan malu2 untuk nimb dan voice yaa',
    'WELCOME YANG BARU GABUNG {user} !',
    'haloo welcomee {user} ',
    'welcome yaaaa! {user} jangan lupa ikut nimbrung',
    'selamat datang {user} jangan malu² yaa buat nimbrung di voice atau chat',
];

// Ambil template random
function getRandomTemplate() {
    return WELCOME_TEMPLATES[Math.floor(Math.random() * WELCOME_TEMPLATES.length)];
}

// Cooldown per-user biar gak spam (key: userId, value: timestamp terakhir)
const cooldowns = new Map();
const COOLDOWN_MS = 30_000; // 30 detik per user

// Cek cooldown
function isOnCooldown(userId) {
    const last = cooldowns.get(userId);
    if (!last) return false;
    return Date.now() - last < COOLDOWN_MS;
}

function setCooldown(userId) {
    cooldowns.set(userId, Date.now());
}

// =====================================================
// CLIENT
// =====================================================

const token = process.env.WELCOME_TOKEN;

if (!token || token === 'YOUR_WELCOME_TOKEN_HERE') {
    console.log('');
    console.log('❌ WELCOME_TOKEN belum di-set!');
    console.log('');
    console.log('   Tambahkan di .env:');
    console.log('   WELCOME_TOKEN=token_akun_welcome_kamu');
    console.log('');
    process.exit(1);
}

if (WELCOME_CHANNEL_ID === 'YOUR_TEXT_CHANNEL_ID_HERE') {
    console.log('');
    console.log('❌ WELCOME_CHANNEL_ID belum di-set!');
    console.log('');
    console.log('   Buka welcome.js dan ganti:');
    console.log('   const WELCOME_CHANNEL_ID = \'YOUR_TEXT_CHANNEL_ID_HERE\';');
    console.log('   Jadi ID channel text kamu.');
    console.log('');
    process.exit(1);
}

const client = new Client({ checkUpdate: false });

// Saat bot ready
client.on('ready', () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('   👋 Discord Welcome Selfbot');
    console.log('═══════════════════════════════════════════');
    log(`📡 Logged in sebagai: ${client.user.tag}`);
    log(`🆔 User ID: ${client.user.id}`);
    log(`🎯 Target Channel: ${WELCOME_CHANNEL_ID}`);
    log(`🎲 Total template pesan: ${WELCOME_TEMPLATES.length}`);
    log(`⏱️ Cooldown per user: ${COOLDOWN_MS / 1000} detik`);
    console.log('═══════════════════════════════════════════');
    console.log('');
});

// Trigger: ada member join guild
client.on('guildMemberAdd', async (member) => {
    try {
        log(`👤 ${member.user.tag} (${member.user.id}) join guild: ${member.guild.name}`);

        // Cek cooldown
        if (isOnCooldown(member.user.id)) {
            log(`⏭️ ${member.user.tag} masih cooldown, skip`);
            return;
        }

        // Ambil channel target
        const channel = client.channels.cache.get(WELCOME_CHANNEL_ID)
            || await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);

        if (!channel) {
            log('❌ Channel text tidak ditemukan! Cek WELCOME_CHANNEL_ID');
            return;
        }

        if (!channel.isText()) {
            log('❌ Channel yang di-set bukan text channel!');
            return;
        }

        // Delay random biar natural
        const delay = humanDelay();
        log(`⏳ Kirim welcome dalam ${Math.round(delay / 1000)} detik...`);

        setTimeout(async () => {
            try {
                // Cek lagi apakah member masih ada di guild (mungkin udah keluar)
                const stillThere = member.guild.members.cache.get(member.user.id);
                if (!stillThere) {
                    log(`👻 ${member.user.tag} udah keluar sebelum pesan dikirim, skip`);
                    return;
                }

                // Ambil template random
                const template = getRandomTemplate();

                // Replace placeholder
                const message = template
                    .replace('{user}', `<@${member.user.id}>`)
                    .replace('{name}', member.user.username);

                // Kirim pesan
                await channel.send(message);
                setCooldown(member.user.id);
                log(`✅ Welcome dikirim untuk ${member.user.tag}: "${message}"`);
            } catch (err) {
                log(`❌ Gagal kirim welcome: ${err.message}`);
            }
        }, delay);

    } catch (err) {
        log(`❌ Error di guildMemberAdd: ${err.message}`);
    }
});

// Handle error biar gak crash
client.on('error', (error) => {
    log(`❌ Client error: ${error.message}`);
});

client.on('warn', (warning) => {
    log(`⚠️ Warning: ${warning}`);
});

client.on('disconnect', () => {
    log('⚠️ Client disconnected dari Discord');
});

client.on('reconnecting', () => {
    log('🔄 Client reconnecting ke Discord...');
});

// Login
log('🚀 Starting welcome bot...');
client.login(token);

// Graceful shutdown
process.on('SIGINT', () => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] 👋 Shutting down welcome bot...`);
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] 👋 Shutting down welcome bot...`);
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] ❌ Unhandled rejection: ${error.message || error}`);
});
